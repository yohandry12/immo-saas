"use client";
import { useEffect, useState } from "react";
import { API_URL } from "./api";
import { getSession } from "./session";

export type FeedEvent = {
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

// EventSource ne peut pas envoyer Authorization : on lit le flux à la main.
export function useActivityFeed(enabled: boolean) {
  const [events, setEvents] = useState<FeedEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const ctrl = new AbortController();

    (async () => {
      const session = getSession();
      // Le flux d'activité est scoped org : sans orgId (compte
      // locataire), il n'existe pas — on ne se connecte pas.
      if (!session?.orgId) return;

      const res = await fetch(`${API_URL}/dashboard/stream`, {
        headers: {
          Authorization: `Bearer ${session.token}`,
          "X-Org-Id": session.orgId,
        },
        signal: ctrl.signal,
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const chunk = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const data = chunk.replace(/^data:\s?/, "");
          if (!data) continue;
          try {
            const event = JSON.parse(data) as FeedEvent;
            setEvents((prev) => [event, ...prev].slice(0, 50));
          } catch {
            // ligne partielle : on attend la suite
          }
        }
      }
    })().catch(() => {
      // connexion coupée : silencieux au MVP
    });

    return () => ctrl.abort();
  }, [enabled]);

  return events;
}
