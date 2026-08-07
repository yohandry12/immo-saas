import axios from "axios";
import { goToLogin } from "./navigation";
import {
  clearSession,
  getAccessToken,
  getSession,
  setAccessToken,
} from "./session";

// URL RELATIVE : le navigateur appelle la même origine que la page, et
// Next (dev) ou le reverse proxy (prod) route vers l'API. C'est ce qui
// rend le cookie SameSite=Strict utilisable.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

// withCredentials : sans lui, axios n'envoie pas le cookie de refresh
// sur /auth/refresh et /auth/logout.
export const api = axios.create({ baseURL: API_URL, withCredentials: true });

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Un compte locataire n'a pas d'org : on n'envoie pas d'en-tête vide.
  const orgId = getSession()?.orgId;
  if (orgId) config.headers["X-Org-Id"] = orgId;

  return config;
});

// ---------- Auto-refresh ----------
// Une seule promesse partagée : si 5 requêtes reçoivent un 401 en même
// temps, UN SEUL appel /auth/refresh part (sinon la rotation invalide
// les refresh des autres → déconnexion en cascade).
let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  try {
    // Pas de corps : le cookie httpOnly EST la preuve. axios brut, pas
    // `api` : l'instance interceptée rejouerait ce code en boucle sur
    // un 401 du refresh. withCredentials explicite car on court-circuite
    // l'instance configurée.
    const r = await axios.post<{ token: string }>(
      `${API_URL}/auth/refresh`,
      undefined,
      { withCredentials: true },
    );
    setAccessToken(r.data.token);
    return r.data.token;
  } catch {
    return null; // cookie mort ou absent : la session est finie
  }
}

/**
 * Rôle : restaurer la session après un rechargement de page, où
 * l'access en mémoire est perdu mais le cookie survit.
 * Renvoie true si la session est repartie.
 */
export async function restoreSession(): Promise<boolean> {
  if (getAccessToken()) return true;
  refreshing ??= tryRefresh().finally(() => {
    refreshing = null;
  });
  return (await refreshing) !== null;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== "undefined"
    ) {
      const config = error.config as
        | (typeof error.config & { _retried?: boolean })
        | undefined;

      // Jamais de refresh pour les routes d'auth elles-mêmes (login raté
      // ≠ session expirée), ni pour une requête déjà rejouée une fois.
      const isAuthRoute = (config?.url ?? "").startsWith("/auth/");
      if (config && !config._retried && !isAuthRoute) {
        refreshing ??= tryRefresh().finally(() => {
          refreshing = null;
        });
        const token = await refreshing;
        if (token) {
          config._retried = true;
          config.headers = config.headers ?? {};
          config.headers.Authorization = `Bearer ${token}`;
          return api.request(config);
        }
      }

      clearSession();
      goToLogin();
    }
    return Promise.reject(error);
  },
);

// Le message d'erreur métier du backend vit dans response.data.error.
export function errorMessage(e: unknown): string {
  if (axios.isAxiosError(e)) {
    return (
      (e.response?.data as { error?: string } | undefined)?.error ?? e.message
    );
  }
  return e instanceof Error ? e.message : "Erreur inconnue";
}
