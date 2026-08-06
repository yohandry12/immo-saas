// Redirection vers /login HORS composant React (intercepteur axios, timer).
// useRouter() est impossible ici : pas de contexte React.
//
// Le rechargement complet est VOULU pour un logout : il purge tout l'état
// client en mémoire (recommandation de la doc Next, preserving-ui-state).
// La règle lint interdit seulement les destinations RELATIVES
// (elles cassent avec basePath/locale) : on construit donc l'URL ABSOLUE.
export function goToLogin() {
  if (typeof window === "undefined") return;
  window.location.assign(new URL("/login", window.location.origin).toString());
}
