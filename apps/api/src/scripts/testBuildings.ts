// Teste le module buildings contre le VRAI serveur (doit tourner).
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:buildings
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
      lastName: "Buildings",
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
  const A = await loginOrRegister("buildings-a@test.cm", "Immeubles A");
  const B = await loginOrRegister("buildings-b@test.cm", "Immeubles B");

  // 1. A déclare un immeuble puis un appartement
  const created = await fetch(`${BASE}/buildings`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({ name: "Résidence Akwa", city: "Douala" }),
  });
  assert.equal(created.status, 201, "création immeuble");
  const building = await created.json();

  const unit = await fetch(`${BASE}/buildings/${building.id}/units`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({ label: "A1", rentAmount: 85000 }),
  });
  assert.equal(unit.status, 201, "création appartement");

  // 2. Liste et détail
  const list = await fetch(`${BASE}/buildings`, {
    headers: headers(A.token, A.orgId),
  });
  assert.equal(list.status, 200);
  assert.ok((await list.json()).length >= 1, "au moins un immeuble listé");

  const detail = await fetch(`${BASE}/buildings/${building.id}`, {
    headers: headers(A.token, A.orgId),
  });
  assert.equal(detail.status, 200);
  assert.equal(
    (await detail.json()).units.length,
    1,
    "l’appartement apparaît au détail",
  );

  // 3. Isolation couche 1 : B pointe son header sur l'org de A -> 403
  const cross1 = await fetch(`${BASE}/buildings`, {
    headers: headers(B.token, A.orgId),
  });
  assert.equal(cross1.status, 403, "middleware requireOrg bloque B");

  // 4. Isolation couche 2 : B reste dans SON org mais demande
  //    l'immeuble de A -> 404 (le service ne révèle rien)
  const cross2 = await fetch(`${BASE}/buildings/${building.id}`, {
    headers: headers(B.token, B.orgId),
  });
  assert.equal(
    cross2.status,
    404,
    "le service ne révèle pas les immeubles d’autrui",
  );

  // 5. « Occupé à la création » : unité + bail en un seul geste
  const occupied = await fetch(`${BASE}/buildings/${building.id}/units`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      label: "A2",
      rentAmount: 100000,
      lease: {
        tenantName: "Sandra Mballa",
        tenantPhone: "+237699000077",
        advanceMonths: 6,
        depositAmount: 200000,
      },
    }),
  });
  assert.equal(occupied.status, 201, "unité occupée créée");
  const occ = await occupied.json();
  assert.ok(occ.lease, "le bail est créé avec l’appartement");
  assert.equal(occ.lease.tenantName, "Sandra Mballa");
  assert.equal(occ.expectedMoveInTotal, 800000, "6 mois + caution");

  // 6. Le bail imbriqué est visible depuis le module baux (source unique)
  const leases = await (
    await fetch(`${BASE}/leases?active=true`, {
      headers: headers(A.token, A.orgId),
    })
  ).json();
  assert.ok(
    leases.some((l: { id: string }) => l.id === occ.lease.id),
    "bail visible dans /leases",
  );

  // 7. lease mal formé (pas de nom) -> 400, et rien n'est créé
  const badLease = await fetch(`${BASE}/buildings/${building.id}/units`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      label: "A3",
      rentAmount: 50000,
      lease: { tenantPhone: "+237699000078" },
    }),
  });
  assert.equal(badLease.status, 400);

  // 8. Isolation : B ne peut pas créer d'unité (ni de bail) chez A
  const cross3 = await fetch(`${BASE}/buildings/${building.id}/units`, {
    method: "POST",
    headers: headers(B.token, B.orgId),
    body: JSON.stringify({ label: "X1", rentAmount: 10000 }),
  });
  assert.equal(cross3.status, 404);

  console.log(
    "✅ Buildings vérifié : création, liste, détail, occupied-at-creation, isolation — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
