import { useSyncExternalStore } from "react";

// La session persistée ne contient plus AUCUN secret : seulement
// l'organisation choisie, que l'API revérifie de toute façon à chaque
// requête (middleware requireOrg).
export type Session = { orgId?: string };

const SESSION_KEY = "immo-session";
const LOGOUT_KEY = "immo-logout";

// ---------- Access token : en mémoire, jamais sur disque ----------
// Une variable de module vit le temps de l'onglet. Au rechargement,
// l'access est perdu et regénéré par un refresh silencieux (le cookie,
// lui, survit). Une XSS ne trouve donc rien de durable à voler.
let accessToken: string | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

// ---------- Présence de session ----------
// Hydration-safe : le serveur répond « pas encore su » (null), le
// client corrige après hydratation. L'événement storage synchronise
// aussi la déconnexion entre onglets.
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

export function useHasSession(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => !!localStorage.getItem(SESSION_KEY),
    () => null,
  );
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    // localStorage corrompu : on repart proprement plutôt que de
    // laisser une exception casser tous les écrans.
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function setSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  accessToken = null;
}

/**
 * Rôle : prévenir les AUTRES onglets qu'on vient de se déconnecter.
 * Le refresh étant en cookie httpOnly, l'événement storage ne le voit
 * plus : sans ce drapeau, un onglet resté ouvert continuerait jusqu'à
 * sa prochaine expiration d'access (15 min). Sur un poste partagé,
 * c'est trop long.
 * Ce n'est PAS un secret : juste un horodatage qui déclenche
 * l'événement storage.
 */
export function signalLogout() {
  localStorage.setItem(LOGOUT_KEY, String(Date.now()));
}

/**
 * Rôle : réagir au logout d'un autre onglet. Renvoie la fonction de
 * désabonnement.
 */
export function onLogoutSignal(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === LOGOUT_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}
