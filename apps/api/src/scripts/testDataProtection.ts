// Teste la protection des données de bout en bout contre le VRAI serveur.
import "dotenv/config";
import assert from "node:assert";

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;

async function registerOwner() {
  const res = await fetch(`${BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `dp-owner-${Date.now()}@test.cm`,
      password: "password123",
      firstName: "Proprio",
      lastName: "Protection",
      orgName: "Immeubles Protection",
    }),
  });
  const d = await res.json();
  return { token: d.token as string, orgId: d.org.id as string };
}

const headers = (token: string, orgId?: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  ...(orgId ? { "X-Org-Id": orgId } : {}),
});

async function main() {
  const A = await registerOwner();
  const h = headers(A.token, A.orgId);
  const suffix = String(Date.now()).slice(-8);

  // Setup : immeuble + 2 appartements + 2 locataires + 1 agent
  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Résidence DP", city: "Douala" }),
    })
  ).json();

  const unit1 = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ label: "DP1", rentAmount: 60000 }),
    })
  ).json();
  const unit2 = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ label: "DP2", rentAmount: 60000 }),
    })
  ).json();

  const phone1 = `+2376${suffix.slice(0, 8)}`;
  const phone2 = `+2377${suffix.slice(0, 8)}`;
  const lease1 = await (
    await fetch(`${BASE}/leases`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        unitId: unit1.id,
        tenantName: "Locataire Un",
        tenantPhone: phone1,
      }),
    })
  ).json();
  await fetch(`${BASE}/leases`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      unitId: unit2.id,
      tenantName: "Locataire Deux",
      tenantPhone: phone2,
    }),
  });

  const regT1 = await (
    await fetch(`${BASE}/auth/tenant/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone1,
        password: "locataire123",
        firstName: "Locataire",
        lastName: "Un",
      }),
    })
  ).json();
  const regT2 = await (
    await fetch(`${BASE}/auth/tenant/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: phone2,
        password: "locataire123",
        firstName: "Locataire",
        lastName: "Deux",
      }),
    })
  ).json();

  const managerEmail = `dp-agent-${Date.now()}@test.cm`;
  await fetch(`${BASE}/org/managers`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      email: managerEmail,
      password: "agent12345",
      firstName: "Agent",
      lastName: "Terrain",
    }),
  });
  const mLogin = await (
    await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: managerEmail, password: "agent12345" }),
    })
  ).json();
  const mh = headers(mLogin.token as string, A.orgId);

  // 1. L'agent encaisse : son NOM est gravé dans l'écriture
  await fetch(`${BASE}/payments`, {
    method: "POST",
    headers: mh,
    body: JSON.stringify({
      unitId: unit1.id,
      kind: "RENT",
      method: "CASH",
      amount: 60000,
    }),
  });
  let journal = await (await fetch(`${BASE}/payments`, { headers: h })).json();
  assert.ok(
    journal.some(
      (p: { recordedByName: string | null }) =>
        p.recordedByName === "Agent Terrain",
    ),
    "nom de l’agent gravé",
  );

  // 2. Un non-propriétaire ne révoque personne
  const selfRevoke = await fetch(`${BASE}/org/members/${mLogin.user.id}`, {
    method: "DELETE",
    headers: mh,
  });
  assert.equal(selfRevoke.status, 403, "agent ne révoque pas");

  // 3. Le propriétaire révoque l'agent : accès coupé, compte intact
  const members = await (
    await fetch(`${BASE}/org/members`, { headers: h })
  ).json();
  const agentMember = members.find(
    (m: { user: { email: string | null } }) => m.user.email === managerEmail,
  );
  const revoke = await fetch(`${BASE}/org/members/${agentMember.user.id}`, {
    method: "DELETE",
    headers: h,
  });
  assert.equal(revoke.status, 204, "révocation");
  const afterRevoke = await fetch(`${BASE}/buildings`, { headers: mh });
  assert.equal(afterRevoke.status, 403, "agent révoqué hors de l’org");

  // 4. L'agent supprime son compte : le NOM reste sur l'écriture
  const agentDelete = await fetch(`${BASE}/auth/me`, {
    method: "DELETE",
    headers: headers(mLogin.token as string),
  });
  assert.equal(agentDelete.status, 204);
  journal = await (await fetch(`${BASE}/payments`, { headers: h })).json();
  const traced = journal.find(
    (p: { recordedByName: string | null }) =>
      p.recordedByName === "Agent Terrain",
  );
  assert.ok(traced && traced.recordedById === null, "traçabilité survivante");

  // 5. Bail terminé + compte supprimé = téléphone masqué, nom conservé
  await fetch(`${BASE}/leases/${lease1.id}/terminate`, {
    method: "POST",
    headers: h,
  });
  const t1Delete = await fetch(`${BASE}/auth/me`, {
    method: "DELETE",
    headers: headers(regT1.token as string),
  });
  assert.equal(t1Delete.status, 204);
  const leaseAfter = await (
    await fetch(`${BASE}/leases/${lease1.id}`, { headers: h })
  ).json();
  assert.equal(leaseAfter.tenantPhone, null, "téléphone masqué (bail terminé)");
  assert.equal(leaseAfter.tenantName, "Locataire Un", "nom conservé");

  // 6. Bail actif + compte supprimé = téléphone conservé (contrat en cours)
  const t2Delete = await fetch(`${BASE}/auth/me`, {
    method: "DELETE",
    headers: headers(regT2.token as string),
  });
  assert.equal(t2Delete.status, 204);
  const leases = await (
    await fetch(`${BASE}/leases?active=true`, { headers: h })
  ).json();
  const active2 = leases.find(
    (l: { tenantName: string }) => l.tenantName === "Locataire Deux",
  );
  assert.equal(active2.tenantPhone, phone2, "téléphone conservé (bail actif)");

  // 7. Un propriétaire avec portefeuilles ne peut pas supprimer son compte
  const ownerDelete = await fetch(`${BASE}/auth/me`, {
    method: "DELETE",
    headers: headers(A.token),
  });
  assert.equal(ownerDelete.status, 409, "propriétaire protégé malgré lui");

  console.log(
    "✅ Protection des données vérifié : révocation, traçabilité, masquage, gardes — OK",
  );
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
