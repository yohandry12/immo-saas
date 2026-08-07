import { useSyncExternalStore } from "react";

// orgId absent = compte locataire : pas de portefeuille, pas de X-Org-Id.
export type Session = { token: string; refreshToken?: string; orgId?: string };

// Présence de session, hydration-safe : le serveur répond « non » (il ne
// voit pas localStorage), le client corrige juste après l'hydratation.
// Bonus : l'événement storage synchronise la déconnexion entre onglets.
function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

// null = « pas encore su » (rendu serveur / hydratation en cours) :
// indispensable pour ne pas rediriger vers /login sur la valeur
// transitoire d'avant la lecture de localStorage.
export function useHasSession(): boolean | null {
  return useSyncExternalStore(
    subscribe,
    () => !!localStorage.getItem("immo-session"),
    () => null,
  );
}

export function getSession(): Session | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('immo-session');
  return raw ? (JSON.parse(raw) as Session) : null;
}

export function setSession(s: Session) {
  localStorage.setItem('immo-session', JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem('immo-session');
}