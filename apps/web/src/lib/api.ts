import axios from "axios";
import { goToLogin } from "./navigation";
import { clearSession, getSession, setSession } from "./session";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

// Une seule instance configurée pour tout le site.
export const api = axios.create({ baseURL: API_URL });

// Intercepteur request : clé d'accès + portefeuille injectés une fois,
// pour tous les appels, sans répétition dans les pages.
api.interceptors.request.use((config) => {
  const session = getSession();
  if (session) {
    config.headers.Authorization = `Bearer ${session.token}`;
    // Un compte locataire n'a pas d'org : on n'envoie pas d'en-tête vide.
    if (session.orgId) config.headers["X-Org-Id"] = session.orgId;
  }
  return config;
});

// ---------- Auto-refresh ----------
// Une seule promesse partagée : si 5 requêtes reçoivent un 401 en même
// temps, UN SEUL appel /auth/refresh part (sinon la rotation invalide
// les refresh des autres → déconnexion en cascade).
let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const session = getSession();
  if (!session?.refreshToken) return null;
  try {
    // axios BRUT, pas `api` : l'instance interceptée re-déclencherait
    // ce même code en boucle sur un 401 du refresh.
    const r = await axios.post<{ token: string; refreshToken: string }>(
      `${API_URL}/auth/refresh`,
      { refreshToken: session.refreshToken },
    );
    setSession({ ...session, token: r.data.token, refreshToken: r.data.refreshToken });
    return r.data.token;
  } catch {
    return null; // refresh mort : la session est vraiment finie
  }
}

// Intercepteur response : 401 → tenter UN refresh puis rejouer la
// requête. Refresh impossible → session morte → retour login.
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
