"use client";
import { useEffect } from "react";
import { api } from "./api";
import { goToLogin } from "./navigation";
import { clearSession, getSession } from "./session";

// Le navigateur MESURE l'inactivité ; le serveur EXÉCUTE la sentence.
// 15 minutes sans geste → logout réel (liste noire) puis retour login.
export function useIdleLogout(enabled: boolean, timeoutMs = 15 * 60 * 1000) {
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;

    const fire = () => {
      // Même instance axios que le reste : intercepteurs inclus.
      // refreshToken envoyé pour que le serveur le révoque AUSSI :
      // sans lui, la session renaîtrait au prochain refresh.
      api
        .post("/auth/logout", { refreshToken: getSession()?.refreshToken })
        .catch(() => {})
        .finally(() => {
          clearSession();
          goToLogin();
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
