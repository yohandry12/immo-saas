// Teste le module payments contre le VRAI serveur (doit tourner).
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:payments
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
      lastName: "Payments",
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
    "payments-a@test.cm",
    "Immeubles Paiements A",
  );
  const B = await loginOrRegister(
    "payments-b@test.cm",
    "Immeubles Paiements B",
  );

  // Un immeuble + un appartement pour A
  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: headers(A.token, A.orgId),
      body: JSON.stringify({ name: "Résidence Bonapriso", city: "Douala" }),
    })
  ).json();
  const unit = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: headers(A.token, A.orgId),
      body: JSON.stringify({ label: "B1", rentAmount: 100000 }),
    })
  ).json();

  // 1. Saisie manuelle d'un loyer en espèces -> 201, CONFIRMED
  const rec = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      kind: "RENT",
      method: "CASH",
      amount: 100000,
    }),
  });
  assert.equal(rec.status, 201, "enregistrement du paiement");
  const payment = await rec.json();
  assert.equal(payment.status, "CONFIRMED", "saisie manuelle = confirmé");

  // 2. Montant négatif -> 400 (zod avant tout)
  const bad = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      kind: "RENT",
      method: "CASH",
      amount: -50,
    }),
  });
  assert.equal(bad.status, 400);

  // 3. Le journal de A contient le paiement, avec l'étiquette lisible
  const list = await fetch(`${BASE}/payments`, {
    headers: headers(A.token, A.orgId),
  });
  assert.equal(list.status, 200);
  const payments = await list.json();
  const found = payments.find((p: { id: string }) => p.id === payment.id);
  assert.ok(
    found && found.unit.label === "B1",
    "paiement visible avec son étiquette",
  );

  // 4. Isolation : le journal de B ne contient rien de A
  const listB = await fetch(`${BASE}/payments`, {
    headers: headers(B.token, B.orgId),
  });
  const paymentsB = await listB.json();
  assert.ok(
    !paymentsB.some((p: { id: string }) => p.id === payment.id),
    "B ne voit pas les paiements de A",
  );

  // 5. Isolation : B ne peut pas saisir sur l'appartement de A -> 404
  const cross = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: headers(B.token, B.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      kind: "RENT",
      method: "CASH",
      amount: 100000,
    }),
  });
  assert.equal(cross.status, 404);

  // 6. Réalité camerounaise : avance de 6 mois + caution de 2 mois
  //    (loyer de B1 = 100 000 FCFA)
  const advance = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      kind: "RENT",
      method: "MOMO",
      amount: 600000,
      periodFrom: "2026-08",
      periodTo: "2027-01",
    }),
  });
  assert.equal(advance.status, 201, "avance de 6 mois enregistrée");

  const deposit = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      kind: "DEPOSIT",
      method: "MOMO",
      amount: 200000,
    }),
  });
  assert.equal(deposit.status, 201, "caution enregistrée");

  // 7. periodTo sans periodFrom -> 400
  const badPeriod = await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: headers(A.token, A.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      kind: "RENT",
      method: "CASH",
      amount: 100000,
      periodTo: "2027-01",
    }),
  });
  assert.equal(badPeriod.status, 400);

  console.log(
    "✅ Payments vérifié : saisie, journal, validation, isolation — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
