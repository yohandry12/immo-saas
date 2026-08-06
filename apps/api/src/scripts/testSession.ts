// Teste la mort réelle des jetons contre le VRAI serveur (Redis requis).
import 'dotenv/config';
import assert from 'node:assert';

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const json = { 'Content-Type': 'application/json' };

async function main() {
  const email = `session-${Date.now()}@test.cm`;
  const reg = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers: json,
    body: JSON.stringify({ email, password: 'password123', firstName: 'Sess', lastName: 'Ion', orgName: 'Immeubles Session' }),
  });
  const token1 = (await reg.json()).token as string;

  // Deux sessions indépendantes du même compte
  const login = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: json,
    body: JSON.stringify({ email, password: 'password123' }),
  });
  const token2 = (await login.json()).token as string;

  const me = (t: string) => fetch(`${BASE}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });

  assert.equal((await me(token1)).status, 200);
  assert.equal((await me(token2)).status, 200);

  // Déconnecte la session 1 seulement
  const out = await fetch(`${BASE}/auth/logout`, {
    method: 'POST', headers: { Authorization: `Bearer ${token1}` },
  });
  assert.equal(out.status, 204);

  assert.equal((await me(token1)).status, 401, 'jeton déconnecté = mort');
  assert.equal((await me(token2)).status, 200, 'les autres sessions vivent');

  console.log('✅ Sessions vérifié : logout par jeton, liste noire, sessions indépendantes — OK');
}

main().catch((e) => {
  console.error('❌ Test échoué :', e.message);
  process.exitCode = 1;
});