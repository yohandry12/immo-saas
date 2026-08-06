// Teste la carte de permissions OWNER/MANAGER contre le VRAI serveur.
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
      firstName: "Proprio",
      lastName: "Test",
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
  const A = await loginOrRegister(
    `perm-${Date.now()}@test.cm`,
    "Immeubles Permissions",
  );
  const h = headers(A.token, A.orgId);
  const managerEmail = `perm-agent-${Date.now()}@test.cm`;

  // 1. Le propriétaire crée le compte de son agent -> 201
  const inv = await fetch(`${BASE}/org/managers`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      email: managerEmail,
      password: "agent12345",
      firstName: "Agent",
      lastName: "Terrain",
    }),
  });
  assert.equal(inv.status, 201, "invitation agent");

  // Double invitation -> 409
  const inv2 = await fetch(`${BASE}/org/managers`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      email: managerEmail,
      password: "agent12345",
      firstName: "Agent",
      lastName: "Terrain",
    }),
  });
  assert.equal(inv2.status, 409);

  // 2. L'agent se connecte et travaille dans l'org du propriétaire
  const mLogin = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: managerEmail, password: "agent12345" }),
  });
  assert.equal(mLogin.status, 200, "login agent");
  const mh = headers((await mLogin.json()).token as string, A.orgId);

  // 3. Opérationnel ouvert à l'agent : lecture + saisie
  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Résidence Permissions", city: "Douala" }),
    })
  ).json();
  assert.equal(
    (await fetch(`${BASE}/buildings`, { headers: mh })).status,
    200,
    "lecture agent OK",
  );

  const unit = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ label: "P1", rentAmount: 50000 }),
    })
  ).json();

  const payByAgent = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: mh,
    body: JSON.stringify({
      unitId: unit.id,
      kind: "RENT",
      method: "CASH",
      amount: 50000,
    }),
  });
  assert.equal(payByAgent.status, 201, "l’agent encaisse (opérationnel)");

  // 4. Patrimonial fermé à l'agent : créer/supprimer un immeuble -> 403
  const createAsAgent = await fetch(`${BASE}/buildings`, {
    method: "POST",
    headers: mh,
    body: JSON.stringify({ name: "Tentative", city: "Douala" }),
  });
  assert.equal(createAsAgent.status, 403, "agent ne crée pas d’immeuble");

  const deleteAsAgent = await fetch(`${BASE}/buildings/${building.id}`, {
    method: "DELETE",
    headers: mh,
  });
  assert.equal(deleteAsAgent.status, 403, "agent ne supprime pas d’immeuble");

  // 5. Même le propriétaire ne détruit pas la comptabilité : 409
  const deleteWithHistory = await fetch(`${BASE}/buildings/${building.id}`, {
    method: "DELETE",
    headers: h,
  });
  assert.equal(
    deleteWithHistory.status,
    409,
    "historique de paiements protégé",
  );

  const deleteUnitWithPayment = await fetch(
    `${BASE}/buildings/${building.id}/units/${unit.id}`,
    { method: "DELETE", headers: h },
  );
  assert.equal(
    deleteUnitWithPayment.status,
    409,
    "appartement avec historique protégé",
  );

  // 6. Un immeuble sans historique se supprime proprement
  const empty = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Immeuble Vide", city: "Douala" }),
    })
  ).json();
  const del = await fetch(`${BASE}/buildings/${empty.id}`, {
    method: "DELETE",
    headers: h,
  });
  assert.equal(del.status, 204, "suppression sans historique");

  console.log(
    "✅ Permissions vérifié : invitation agent, opérationnel ouvert, patrimonial verrouillé, comptabilité protégée — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
