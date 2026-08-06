// Teste le module dépenses contre le VRAI serveur.
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
      lastName: "Expenses",
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
  // Orgs uniques par run : on asserte des totaux exacts.
  const A = await loginOrRegister(
    `exp-a-${Date.now()}@test.cm`,
    "Immeubles Dépenses A",
  );
  const B = await loginOrRegister(
    `exp-b-${Date.now()}@test.cm`,
    "Immeubles Dépenses B",
  );
  const h = headers(A.token, A.orgId);

  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Résidence Panne", city: "Douala" }),
    })
  ).json();

  // 1. Création d'une dépense -> 201 + événement publié
  const created = await fetch(`${BASE}/expenses`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      buildingId: building.id,
      category: "PLUMBING",
      amount: 35000,
      description: "Fuite cuisine B2",
      photos: ["https://storage.immo.cm/photos/abc.jpg"],
    }),
  });
  assert.equal(created.status, 201, "création dépense");
  const expense = await created.json();
  assert.equal(expense.amount, 35000);
  assert.equal(expense.photos.length, 1);

  // 2. Liste des dépenses du portefeuille
  const list = await (await fetch(`${BASE}/expenses`, { headers: h })).json();
  assert.ok(
    list.some((e: { id: string }) => e.id === expense.id),
    "dépense dans la liste",
  );

  // 3. Détail avec photos
  const detail = await (
    await fetch(`${BASE}/expenses/${expense.id}`, { headers: h })
  ).json();
  assert.equal(detail.photos[0], "https://storage.immo.cm/photos/abc.jpg");

  // 4. L'événement est publié au flux
  const activity = await (
    await fetch(`${BASE}/dashboard/activity`, { headers: h })
  ).json();
  assert.ok(
    activity.some((e: { type: string }) => e.type === "EXPENSE_CREATED"),
    "événement EXPENSE_CREATED au flux",
  );

  // 5. Isolation : B ne peut pas lire la dépense de A
  const cross = await fetch(`${BASE}/expenses/${expense.id}`, {
    headers: headers(B.token, B.orgId),
  });
  assert.equal(cross.status, 404);

  // 6. Isolation : B ne peut pas créer une dépense sur l'immeuble de A
  const crossCreate = await fetch(`${BASE}/expenses`, {
    method: "POST",
    headers: headers(B.token, B.orgId),
    body: JSON.stringify({
      buildingId: building.id,
      category: "ELECTRIC",
      amount: 10000,
      description: "tentative",
    }),
  });
  assert.equal(crossCreate.status, 404);

  console.log(
    "✅ Dépenses vérifié : création, photos, liste, détail, événement, isolation — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
