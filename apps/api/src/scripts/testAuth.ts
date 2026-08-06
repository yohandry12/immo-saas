// Teste les endpoints auth contre le VRAI serveur (doit tourner).
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:auth
import "dotenv/config";
import assert from "node:assert";

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;

async function main() {
  // 1. register — 201 au premier passage, 409 aux suivants (email pris)
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "diaspora@test.cm",
      password: "password123",
      firstName: "Marie",
      lastName: "Essomba",
      orgName: "Immeubles Essomba",
    }),
  });
  assert.ok(
    [201, 409].includes(reg.status),
    `register inattendu : ${reg.status}`,
  );

  // 2. login correct -> token + exactement 1 org
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "diaspora@test.cm",
      password: "password123",
    }),
  });
  assert.equal(login.status, 200, "login devrait passer");
  const { token, orgs } = await login.json();
  assert.ok(token && orgs.length === 1, "token + 1 org attendus");

  // 3. 401 uniforme : mauvais mot de passe ET compte inexistant
  const bad = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Faux mot de passe, mais VALIDE selon le schéma (8+ caractères) :
    // on veut tester la branche auth (401), pas la branche formulaire (400).
    body: JSON.stringify({ email: "diaspora@test.cm", password: "mauvais123" }),
  });
  assert.equal(bad.status, 401);

  const ghost = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "inexistant@test.cm",
      password: "password123",
    }),
  });
  assert.equal(ghost.status, 401, "même 401 pour un compte inexistant");

  // 4. /me avec token -> 200, sans token -> 401
  const me = await fetch(`${BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(me.status, 200);

  const noToken = await fetch(`${BASE}/auth/me`);
  assert.equal(noToken.status, 401);

  console.log("✅ Auth vérifiée : register, login, 401 uniformes, /me — OK");
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
