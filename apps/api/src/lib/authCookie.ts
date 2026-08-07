import type { Request, Response } from "express";
import { env } from "./env.js";

/**
 * Un SEUL endroit connaît le nom et les attributs du cookie de refresh.
 * Recopier ces attributs ailleurs, c'est prendre le risque qu'une copie
 * perde `httpOnly` un jour — et la protection avec.
 */
export const REFRESH_COOKIE = "immo_refresh";

// Le chemin restreint est une mesure de sécurité, pas un détail : le
// cookie ne part QUE vers les routes d'authentification, jamais sur les
// centaines d'appels métier qui n'en ont pas besoin.
const COOKIE_PATH = "/api/v1/auth";

// 7 jours, aligné sur REFRESH_TTL_S de auth/service.ts.
// res.cookie attend des MILLISECONDES là où Redis compte en secondes.
const MAX_AGE_MS = 7 * 24 * 3600 * 1000;

function options() {
  return {
    httpOnly: true, // hors de portée du JavaScript : tout l'objectif
    sameSite: "strict" as const, // jamais envoyé depuis un autre site
    // Secure exige HTTPS. En développement on est en HTTP : l'activer
    // empêcherait le cookie d'être posé, donc de se connecter.
    secure: env.NODE_ENV === "production",
    path: COOKIE_PATH,
  };
}

/** Rôle : poser le refresh token. Appelé à l'inscription, la connexion
 * et à chaque rotation. */
export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, { ...options(), maxAge: MAX_AGE_MS });
}

/** Rôle : effacer le cookie au logout. Le `path` DOIT être identique à
 * celui de la pose, sinon le navigateur ignore l'effacement et la
 * session paraîtrait ressuscitée au prochain refresh. */
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, options());
}

/** Rôle : lire le refresh envoyé par le navigateur. Renvoie undefined
 * si absent — l'appelant décide du code HTTP. */
export function readRefreshCookie(req: Request): string | undefined {
  const value = (req.cookies as Record<string, unknown> | undefined)?.[
    REFRESH_COOKIE
  ];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
