// Teste le module charges contre le VRAI serveur (doit tourner).
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:charges
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
      firstName: "Test",
      lastName: "Charges",
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

// Retrouve la part d'un appartement dans une facture.
const allocFor = (bill: any, label: string) =>
  bill.allocations.find((a: any) => a.unit.label === label);

async function main() {
  const A = await loginOrRegister("charges-a@test.cm", "Immeubles Charges A");
  const B = await loginOrRegister("charges-b@test.cm", "Immeubles Charges B");
  const h = headers(A.token, A.orgId);

  // Setup : 3 appartements, 2 occupés (E1: 40 m² / 1 pers, E2: 60 m² / 3 pers), 1 vide.
  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Immeuble Elektra", city: "Douala" }),
    })
  ).json();

  const specs = [
    { label: "E1", surfaceM2: 40, occupants: 1 },
    { label: "E2", surfaceM2: 60, occupants: 3 },
    { label: "E3", surfaceM2: 50, occupants: 1 }, // restera vide
  ];
  const units: any[] = [];
  for (const s of specs) {
    units.push(
      await (
        await fetch(`${BASE}/buildings/${building.id}/units`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ ...s, rentAmount: 50000 }),
        })
      ).json(),
    );
  }
  for (const i of [0, 1]) {
    await fetch(`${BASE}/leases`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        unitId: units[i].id,
        tenantName: `Locataire ${i}`,
        tenantPhone: "+23769900000" + i,
      }),
    });
  }

  // 1. EQUAL : 100 000 entre 2 occupés -> 50 000 / 50 000, E3 exclu
  const equal = await (
    await fetch(`${BASE}/charges`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        buildingId: building.id,
        type: "WATER",
        amount: 100000,
        period: PERIOD,
        rule: "EQUAL",
      }),
    })
  ).json();
  assert.equal(allocFor(equal, "E1").amount, 50000);
  assert.equal(allocFor(equal, "E2").amount, 50000);
  assert.ok(!allocFor(equal, "E3"), "l’appartement vide ne paie pas");

  // 2. BY_AREA : 40/60 -> 40 000 / 60 000
  const area = await (
    await fetch(`${BASE}/charges`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        buildingId: building.id,
        type: "ELECTRICITY",
        amount: 100000,
        period: PERIOD,
        rule: "BY_AREA",
      }),
    })
  ).json();
  assert.equal(allocFor(area, "E1").amount, 40000);
  assert.equal(allocFor(area, "E2").amount, 60000);

  // 3. Somme exacte même avec un montant non divisible (plus fort reste)
  const odd = await (
    await fetch(`${BASE}/charges`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        buildingId: building.id,
        type: "WATER",
        amount: 100001,
        period: PERIOD,
        rule: "EQUAL",
      }),
    })
  ).json();
  const oddSum = odd.allocations.reduce((s: number, a: any) => s + a.amount, 0);
  assert.equal(oddSum, 100001, "la somme des parts = le total, au franc près");

  // 4. CUSTOM qui ne somme pas -> 409
  const badCustom = await fetch(`${BASE}/charges`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      buildingId: building.id,
      type: "OTHER",
      amount: 100000,
      period: PERIOD,
      rule: "CUSTOM",
      customAllocations: [{ unitId: units[0].id, amount: 10000 }],
    }),
  });
  assert.equal(badCustom.status, 409);

  // 5. Envoi -> SENT ; deuxième envoi -> 409
  const sent = await fetch(`${BASE}/charges/${equal.id}/send`, {
    method: "POST",
    headers: h,
  });
  assert.equal(sent.status, 200);
  assert.equal((await sent.json()).status, "SENT");
  const sentAgain = await fetch(`${BASE}/charges/${equal.id}/send`, {
    method: "POST",
    headers: h,
  });
  assert.equal(sentAgain.status, 409);

  // 6. Part réglée -> paid true + écriture CHARGE dans le journal
  const paid = await fetch(
    `${BASE}/charges/${equal.id}/allocations/${allocFor(equal, "E1").id}/mark-paid`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({ method: "MOMO" }),
    },
  );
  assert.equal(paid.status, 200);

  const journal = await (
    await fetch(`${BASE}/payments?kind=CHARGE`, { headers: h })
  ).json();
  assert.ok(
    journal.some((p: any) => p.amount === 50000 && p.kind === "CHARGE"),
    "la part est au journal",
  );

  // 7. Isolation : B ne peut pas envoyer la facture de A
  const cross = await fetch(`${BASE}/charges/${equal.id}/send`, {
    method: "POST",
    headers: headers(B.token, B.orgId),
  });
  assert.equal(cross.status, 404);

  console.log(
    "✅ Charges vérifié : répartition exacte, règles, envoi figé, journal, isolation — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
