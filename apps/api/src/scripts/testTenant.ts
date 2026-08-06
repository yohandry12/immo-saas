// Teste le parcours locataire de bout en bout contre le VRAI serveur.
import "dotenv/config";
import assert from "node:assert";

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const PERIOD = new Date().toISOString().slice(0, 7);

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

const headers = (token: string, orgId?: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  ...(orgId ? { "X-Org-Id": orgId } : {}),
});

async function main() {
  // Numéro unique par run : un re-run ne tombe jamais sur 409
  // « téléphone déjà pris », tout en testant deux formats du même numéro.
  const local = "6" + String(Date.now()).slice(-8); // 9 chiffres
  const international = "+237" + local;
  const spaced = local.replace(/(\d{3})(\d{3})(\d{3})/, "$1 $2 $3");

  // Setup propriétaire : immeuble + appartement + bail au téléphone unique
  const A = await loginOrRegister(
    `tenant-owner-${Date.now()}@test.cm`,
    "Immeubles Tenant",
  );
  const h = headers(A.token, A.orgId);

  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Résidence Locataire", city: "Yaoundé" }),
    })
  ).json();
  const unit = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ label: "T1", rentAmount: 60000 }),
    })
  ).json();
  await fetch(`${BASE}/leases`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      unitId: unit.id,
      tenantName: "Jean Kamga",
      tenantPhone: international,
    }),
  });

  // Une facture commune envoyée, pour créer une part due
  const bill = await (
    await fetch(`${BASE}/charges`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        buildingId: building.id,
        type: "WATER",
        amount: 25000,
        period: PERIOD,
        rule: "EQUAL",
      }),
    })
  ).json();
  await fetch(`${BASE}/charges/${bill.id}/send`, {
    method: "POST",
    headers: h,
  });

  // 1. Le locataire s'inscrit avec un AUTRE format du même numéro
  const reg = await fetch(`${BASE}/auth/tenant/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone: spaced,
      password: "locataire123",
      firstName: "Jean",
      lastName: "Kamga",
    }),
  });
  assert.equal(reg.status, 201, "inscription locataire");
  const regData = await reg.json();
  assert.equal(
    regData.linkedLeases,
    1,
    "le bail est rattaché malgré le format différent",
  );
  const tToken = regData.token as string;

  // 2. Login par téléphone
  const login = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: international, password: "locataire123" }),
  });
  assert.equal(login.status, 200, "login par téléphone");

  // 3. Home : loyer non payé + part d'eau due
  const home = await (
    await fetch(`${BASE}/tenant/home`, { headers: headers(tToken) })
  ).json();
  assert.equal(home.leases.length, 1);
  assert.equal(
    home.leases[0].rentPaidForCurrentMonth,
    false,
    "loyer pas encore payé",
  );
  assert.equal(home.leases[0].unpaidCharges.length, 1, "part d'eau due");
  assert.equal(home.leases[0].unpaidCharges[0].amount, 25000);

  // 4. Le propriétaire encaisse le loyer -> le home bascule à payé
  await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      unitId: unit.id,
      kind: "RENT",
      method: "CASH",
      amount: 60000,
      periodFrom: PERIOD,
      periodTo: PERIOD,
    }),
  });
  const home2 = await (
    await fetch(`${BASE}/tenant/home`, { headers: headers(tToken) })
  ).json();
  assert.equal(
    home2.leases[0].rentPaidForCurrentMonth,
    true,
    "loyer visible comme payé",
  );

  // 5. Historique : le paiement apparaît comme reçu
  const pays = await (
    await fetch(`${BASE}/tenant/payments`, { headers: headers(tToken) })
  ).json();
  assert.ok(
    pays.some((p: { amount: number }) => p.amount === 60000),
    "reçu visible",
  );

  // 6. Isolation de rôles : le proprio ne passe pas côté locataire...
  const ownerAsTenant = await fetch(`${BASE}/tenant/home`, {
    headers: headers(A.token),
  });
  assert.equal(ownerAsTenant.status, 403);

  // ...et le locataire ne voit rien côté org
  const tenantAsOwner = await fetch(`${BASE}/buildings`, {
    headers: headers(tToken, A.orgId),
  });
  assert.equal(tenantAsOwner.status, 403);

  console.log(
    "✅ Locataire vérifié : inscription, rattachement, home, reçus, rôles — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
