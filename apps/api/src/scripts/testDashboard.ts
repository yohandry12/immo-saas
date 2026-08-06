// Teste le dashboard contre le VRAI serveur (doit tourner).
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:dashboard
import "dotenv/config";
import assert from "node:assert";

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const PERIOD = new Date().toISOString().slice(0, 7); // mois courant

async function loginOrRegister(email: string, orgName: string) {
  const reg = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "password123",
      firstName: "Test",
      lastName: "Dash",
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
  // Org unique par run : le dashboard asserte des totaux ABSOLUS sur
  // toute l'org — un re-run ne doit pas voir les données du run précédent.
  const A = await loginOrRegister(
    `dash-${Date.now()}@test.cm`,
    "Immeubles Dash A",
  );
  const h = headers(A.token, A.orgId);

  // Setup : 1 immeuble, 2 appartements à 100 000, 2 baux actifs,
  // 1 seul loyer payé pour le mois courant + 1 caution.
  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Résidence Bonamoussadi", city: "Douala" }),
    })
  ).json();

  const units: { id: string }[] = [];
  for (const label of ["D1", "D2"]) {
    units.push(
      await (
        await fetch(`${BASE}/buildings/${building.id}/units`, {
          method: "POST",
          headers: h,
          body: JSON.stringify({ label, rentAmount: 100000 }),
        })
      ).json(),
    );
  }

  for (const [i, name] of ["Paul Etienne", "Ruth Manga"].entries()) {
    await fetch(`${BASE}/leases`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        unitId: units[i].id,
        tenantName: name,
        tenantPhone: "+23769900000" + i,
      }),
    });
  }

  await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      unitId: units[0].id,
      kind: "RENT",
      method: "MOMO",
      amount: 100000,
      periodFrom: PERIOD,
      periodTo: PERIOD,
    }),
  });
  await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      unitId: units[0].id,
      kind: "DEPOSIT",
      method: "MOMO",
      amount: 200000,
    }),
  });

  // 1. La photo du mois
  const summary = await (
    await fetch(`${BASE}/dashboard/summary?period=${PERIOD}`, { headers: h })
  ).json();
  assert.equal(summary.expectedRent, 200000, "attendu = 2 baux actifs");
  assert.equal(summary.collectedRent, 100000, "encaissé = 1 loyer");
  assert.equal(summary.outstandingRent, 100000, "manquant = 1 loyer");
  assert.equal(summary.depositsHeld, 200000, "cautions gardées");
  assert.equal(summary.occupancy.rate, 1, "2 appartements, 2 baux");
  assert.equal(summary.unpaidUnits.length, 1, "un seul impayé");
  assert.equal(summary.unpaidUnits[0].label, "D2");

  // 2. L'historique contient la signature de bail
  const activity = await (
    await fetch(`${BASE}/dashboard/activity`, { headers: h })
  ).json();
  assert.ok(
    activity.some((e: { type: string }) => e.type === "LEASE_SIGNED"),
    "historique alimenté",
  );

  // 3. Le direct : ouvrir le flux, déclencher un paiement, recevoir l'événement
  const ctrl = new AbortController();
  const streamRes = await fetch(`${BASE}/dashboard/stream`, {
    headers: h,
    signal: ctrl.signal,
  });
  assert.equal(streamRes.status, 200, "flux SSE ouvert");

  const reader = streamRes.body!.getReader();
  const decoder = new TextDecoder();

  // Déclenche l'événement UNE FOIS le flux ouvert.
  setTimeout(() => {
    fetch(`${BASE}/payments`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        unitId: units[1].id,
        kind: "RENT",
        method: "CASH",
        amount: 100000,
        periodFrom: PERIOD,
        periodTo: PERIOD,
      }),
    });
  }, 300);

  let buf = "";
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !buf.includes("PAYMENT_RECORDED")) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
  }
  ctrl.abort();
  assert.ok(
    buf.includes("PAYMENT_RECORDED"),
    "le direct a poussé le paiement en temps réel",
  );

  console.log(
    "✅ Dashboard vérifié : photo du mois, historique, flux SSE temps réel — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
