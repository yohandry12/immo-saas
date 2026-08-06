// Teste la chaîne Mobile Money complète contre le VRAI serveur.
// Le test tient le rôle de l'agrégateur : il appelle notre webhook.
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
      lastName: "Momo",
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
  // Org unique par run : on asserte des totaux et des comptes exacts.
  const A = await loginOrRegister(
    `momo-${Date.now()}@test.cm`,
    "Immeubles Momo A",
  );
  const B = await loginOrRegister(
    `momo-b-${Date.now()}@test.cm`,
    "Immeubles Momo B",
  );
  const h = headers(A.token, A.orgId);

  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Résidence Momo", city: "Douala" }),
    })
  ).json();
  const unit = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ label: "M1", rentAmount: 75000 }),
    })
  ).json();

  // 1. Initiation : paiement PENDING + lien renvoyé
  const init = await fetch(`${BASE}/payments/momo/initiate`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      unitId: unit.id,
      method: "MOMO",
      payerPhone: "+237699000001",
    }),
  });
  assert.equal(init.status, 201, "initiation");
  const { reference, paymentUrl } = await init.json();
  assert.ok(reference && paymentUrl, "référence + lien");

  let journal = await (
    await fetch(`${BASE}/payments?unitId=${unit.id}`, { headers: h })
  ).json();
  assert.equal(
    journal[0].status,
    "PENDING",
    "en attente avant le verdict opérateur",
  );

  // 2. Le test joue l'agrégateur : webhook SUCCESS -> CONFIRMED
  const hook = await fetch(`${BASE}/webhooks/momo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, status: "SUCCESS" }),
  });
  assert.equal(hook.status, 200);
  assert.equal((await hook.json()).ok, true);

  journal = await (
    await fetch(`${BASE}/payments?unitId=${unit.id}`, { headers: h })
  ).json();
  assert.equal(
    journal[0].status,
    "CONFIRMED",
    "confirmé par le webhook, pas par le client",
  );
  assert.ok(journal[0].paidAt, "date de paiement posée");

  // 3. Webhook rejoué : idempotent, rien ne double
  const replay = await fetch(`${BASE}/webhooks/momo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference, status: "SUCCESS" }),
  });
  assert.equal((await replay.json()).ok, false, "rejeu ignoré");
  journal = await (
    await fetch(`${BASE}/payments?unitId=${unit.id}`, { headers: h })
  ).json();
  assert.equal(journal.length, 1, "toujours une seule écriture");

  // 4. Référence inconnue : 200 poli, rien ne fuite
  const unknown = await fetch(`${BASE}/webhooks/momo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reference: "nimporte-quoi", status: "SUCCESS" }),
  });
  assert.equal(unknown.status, 200);
  assert.equal((await unknown.json()).ok, false);

  // 5. Le dashboard a bien vu l'événement
  const activity = await (
    await fetch(`${BASE}/dashboard/activity`, { headers: h })
  ).json();
  assert.ok(
    activity.some((e: { type: string }) => e.type === "PAYMENT_CONFIRMED"),
    "flux alimenté",
  );

  // 6. Isolation : B ne peut pas initier sur l'appartement de A
  const cross = await fetch(`${BASE}/payments/momo/initiate`, {
    method: "POST",
    headers: headers(B.token, B.orgId),
    body: JSON.stringify({
      unitId: unit.id,
      method: "MOMO",
      payerPhone: "+237699000002",
    }),
  });
  assert.equal(cross.status, 404);

  console.log(
    "✅ Mobile Money vérifié : initiation, webhook, idempotence, flux, isolation — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
