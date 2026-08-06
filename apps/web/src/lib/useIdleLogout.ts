"use client";
import { useEffect } from "react";
import { api } from "./api";
import { clearSession } from "./session";

// Le navigateur MESURE l'inactivité ; le serveur EXÉCUTE la sentence.
// 15 minutes sans geste → logout réel (liste noire) puis retour login.
export function useIdleLogout(enabled: boolean, timeoutMs = 15 * 60 * 1000) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;

    const fire = () => {
      // Même instance axios que le reste : intercepteurs inclus.
      api
        .post("/auth/logout")
        .catch(() => {})
        .finally(() => {
          clearSession();
          window.location.href = "/login";
        });
    };

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(fire, timeoutMs);
    };

    const events = ["click", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearTimeout(timer);
    };
  }, [enabled, timeoutMs]);
}
