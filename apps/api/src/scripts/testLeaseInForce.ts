// Teste la règle de vigueur : un bail ne compte pas avant son startDate.
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:leaseinforce
import "dotenv/config";
import assert from "node:assert";

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const now = new Date();
const CURRENT = now.toISOString().slice(0, 7);
const PREVIOUS = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  .toISOString()
  .slice(0, 7);

const headers = (token: string, orgId: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  "X-Org-Id": orgId,
});

async function main() {
  const reg = await (
    await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `inforce-${Date.now()}@test.cm`,
        password: "password123",
        firstName: "Test",
        lastName: "InForce",
        orgName: "Vigueur Test",
      }),
    })
  ).json();
  const h = headers(reg.token, reg.org.id);

  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Résidence Vigueur", city: "Douala" }),
    })
  ).json();
  const unit = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ label: "V1", rentAmount: 50000 }),
    })
  ).json();
  // Bail qui DÉBUTE ce mois-ci.
  await fetch(`${BASE}/leases`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      unitId: unit.id,
      tenantName: "Martin Tardif",
      tenantPhone: "+237699000123",
      // CreateLeaseSchema veut un datetime ISO complet (.datetime()),
      // pas "YYYY-MM-DD". 1er du mois courant à minuit UTC.
      startDate: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      ).toISOString(),
    }),
  });

  // Mois ANTÉRIEUR au bail : rien ne doit compter.
  const prev = await (
    await fetch(`${BASE}/dashboard/summary?period=${PREVIOUS}`, { headers: h })
  ).json();
  assert.equal(prev.expectedRent, 0, "aucun attendu avant le début du bail");
  assert.equal(prev.unpaidUnits.length, 0, "aucun impayé avant le début du bail");
  assert.equal(prev.occupancy.occupied, 0, "aucun occupé avant le début du bail");

  // Mois du bail : il doit compter.
  const cur = await (
    await fetch(`${BASE}/dashboard/summary?period=${CURRENT}`, { headers: h })
  ).json();
  assert.equal(cur.expectedRent, 50000, "attendu = 1 bail en vigueur");
  assert.equal(cur.unpaidUnits.length, 1, "1 impayé le mois du bail");
  assert.equal(cur.occupancy.occupied, 1, "1 occupé le mois du bail");

  console.log("✅ Vigueur des baux vérifiée : ni avant le début, oui au mois du bail — OK");
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
