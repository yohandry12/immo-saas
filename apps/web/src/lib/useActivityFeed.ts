"use client";
import { useEffect, useState } from "react";
import { API_URL, forceRefresh } from "./api";
import { getAccessToken, getSession } from "./session";

// Le type vient du contrat partagé : plus de seconde déclaration
// locale qui divergerait en silence du backend.
export type { FeedEvent } from "@immo/shared";
import type { FeedEvent } from "@immo/shared";

// Reconnexion : on repart vite après une coupure brève, puis on
// espace pour ne pas marteler un serveur qui redémarre. Plafond à
// 30 s — au-delà, l'utilisateur croirait le direct mort.
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;

/** Attente interruptible : un abort pendant la pause sort tout de suite. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

// EventSource ne peut pas envoyer Authorization : on lit le flux à la main.
export function useActivityFeed(enabled: boolean) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  // Exposé pour que l'écran puisse dire « reconnexion… » plutôt que
  // d'afficher un direct silencieusement mort.
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();

    /** Une tentative de connexion. Retourne quand le flux se termine. */
    async function connectOnce(session: { token: string; orgId: string }) {
      const res = await fetch(`${API_URL}/dashboard/stream`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
          "X-Org-Id": session.orgId,
        },
        signal: ctrl.signal,
      });

      // 401/403/500 : pas de flux à lire. On lève pour déclencher
      // le backoff plutôt que de planter sur un body absent.
      if (!res.ok || !res.body) {
        throw new Error(`Flux indisponible (HTTP ${res.status})`);
      }

      setConnected(true);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, idx);
            buf = buf.slice(idx + 2);

            // Un bloc SSE peut contenir plusieurs lignes. Les lignes
            // « : » sont des commentaires — c'est la forme du heartbeat
            // envoyé par le serveur pour tenir la connexion ouverte :
            // il maintient le flux vivant sans rien signifier.
            const data = chunk
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trimStart())
              .join("\n");
            if (!data) continue;

            try {
              const event = JSON.parse(data) as FeedEvent;
              setEvents((prev) => [event, ...prev].slice(0, 50));
            } catch {
              // bloc illisible : on ignore et on continue le flux
            }
          }
        }
      } finally {
        // Libère le flux même si la lecture a échoué en cours de route.
        reader.cancel().catch(() => {});
      }
    }

    (async () => {
      let delay = RETRY_MIN_MS;
      // Le tour précédent a-t-il échoué (401, coupure...) ? Si oui, le
      // jeton en mémoire est suspect et doit être renouvelé avant de
      // rouvrir le flux — sinon on rouvre avec le même jeton mort et
      // on tape 401 indéfiniment (le direct meurt en silence).
      let needsFreshToken = false;

      // Boucle de vie du flux : tant que le composant est monté, on
      // reste connecté. Sans elle, la première coupure réseau tuait
      // le direct jusqu'au prochain rechargement de page.
      while (!ctrl.signal.aborted) {
        const session = getSession();
        // Le flux est scoped org : sans orgId (compte locataire),
        // il n'existe pas — inutile de réessayer en boucle.
        if (!session?.orgId) return;

        // L'access token vit en mémoire (plus dans la session persistée,
        // qui le rafraîchissait naturellement à chaque rotation). Ici,
        // un jeton absent ou suspecté expiré doit être renouvelé de
        // force : sinon, soit la boucle rouvre avec un jeton mort et
        // martèle l'API en boucle, soit elle abandonne définitivement
        // alors que la session est toujours valide côté cookie.
        let token = getAccessToken();
        if (!token || needsFreshToken) {
          token = await forceRefresh();
          if (!token) return; // cookie mort : la session est vraiment finie
        }

        try {
          await connectOnce({ token, orgId: session.orgId });
          // Fin propre du flux (serveur qui ferme) : on repart vite.
          delay = RETRY_MIN_MS;
          needsFreshToken = false;
        } catch {
          // Coupure réseau, proxy, ou API indisponible (401 inclus) :
          // on espace, et on renouvellera le jeton au prochain tour.
          delay = Math.min(delay * 2, RETRY_MAX_MS);
          needsFreshToken = true;
        }

        setConnected(false);
        if (ctrl.signal.aborted) return;
        await sleep(delay, ctrl.signal);
      }
    })().catch(() => {
      // La boucle gère ses propres erreurs ; ce filet couvre l'abort.
      setConnected(false);
    });

    return () => ctrl.abort();
  }, [enabled]);

  return { events, connected };
}
