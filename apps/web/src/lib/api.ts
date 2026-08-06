import axios from "axios";
import { clearSession, getSession } from "./session";

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
    config.headers["X-Org-Id"] = session.orgId;
  }
  return config;
});

// Intercepteur response : session morte → retour login, une seule fois.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== "undefined"
    ) {
      clearSession();
      window.location.href = "/login";
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
