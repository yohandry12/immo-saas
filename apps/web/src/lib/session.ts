export type Session = { token: string; refreshToken?: string; orgId: string };

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