// Teste le module leases contre le VRAI serveur (doit tourner).
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:leases
import "dotenv/config";
import assert from "node:assert";

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;

async function loginOrRegister(email: string, orgName: string) {
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password123",
      firstName: "Test",
      lastName: "Leases",
      orgName,
    }),
  });
  if (reg.status === 201) {
    const d = await reg.json();
    return { token: d.token as string, orgId: d.org.id as string };
  }
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "password123" }),
  });
  const d = await login.json();
  return { token: d.token as string, orgId: d.orgs[0].id as string };
}

const headers = (token: string, orgId: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  "X-Org-Id": orgId,
});

async function main() {
  const A = await loginOrRegister("leases-a@test.cm", "Immeubles Baux A");
  const B = await loginOrRegister("leases-b@test.cm", "Immeubles Baux B");

  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: headers(A.token, A.orgId),
      body: JSON.stringify({ name: "Résidence Bastos", city: "Yaoundé" }),
    })
  ).json();
  const unit = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: headers(A.token, A.orgId),
      body: JSON.stringify({ label: "C1", rentAmount: 100000 }),
    })
  ).json();

  // 1. Signature à la camerounaise : 6 mois d'avance + 200 000 de caution
  //    Total attendu = 6 × 100 000 + 200 000 = 800 000
  const created = await fetch(`${BASE}/leases`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      tenantName: "Jean Kamga",
      tenantPhone: "+237699000001",
      advanceMonths: 6,
      depositAmount: 200000,
    }),
  });
  assert.equal(created.status, 201, "signature du bail");
  const lease = await created.json();
  assert.equal(lease.expectedMoveInTotal, 800000, "total d’entrée calculé");

  // 2. Un deuxième bail actif sur le même appartement -> 409
  const dup = await fetch(`${BASE}/leases`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      tenantName: "Autre Personne",
      tenantPhone: "+237699000009",
    }),
  });
  assert.equal(dup.status, 409, "un seul bail actif par appartement");

  // 3. La liste active contient le bail, avec le nom du locataire
  const list = await fetch(`${BASE}/leases?active=true`, {
    headers: headers(A.token, A.orgId),
  });
  assert.equal(list.status, 200);
  assert.ok(
    (await list.json()).some((l: { id: string }) => l.id === lease.id),
    "bail visible en actif",
  );

  // 4. Isolation : B ne lit pas le bail de A
  const cross = await fetch(`${BASE}/leases/${lease.id}`, {
    headers: headers(B.token, B.orgId),
  });
  assert.equal(cross.status, 404);

  // 5. Résiliation puis re-location : l'historique est conservé
  const term = await fetch(`${BASE}/leases/${lease.id}/terminate`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
  });
  assert.equal(term.status, 200, "résiliation");

  const second = await fetch(`${BASE}/leases`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      tenantName: "Ada Ngozi",
      tenantPhone: "+237699000002",
      advanceMonths: 3,
    }),
  });
  assert.equal(second.status, 201, "nouveau bail possible après résiliation");
  const secondLease = await second.json();
  assert.equal(
    secondLease.expectedMoveInTotal,
    300000,
    "3 mois d’avance sans caution",
  );

  // 6. L'ancien bail n'est plus « actif », le nouveau si
  const list2 = await fetch(`${BASE}/leases?active=true`, {
    headers: headers(A.token, A.orgId),
  });
  const actives = await list2.json();
  assert.ok(
    !actives.some((l: { id: string }) => l.id === lease.id),
    "ancien bail sorti des actifs",
  );
  assert.ok(
    actives.some((l: { id: string }) => l.id === secondLease.id),
    "nouveau bail actif",
  );

  console.log(
    "✅ Leases vérifié : signature, total d’entrée, 409, résiliation, historique — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
