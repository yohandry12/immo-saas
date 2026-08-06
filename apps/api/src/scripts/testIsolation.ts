// Prouve que le propriétaire A ne peut PAS accéder à l'org du propriétaire B.
// Ce test tourne contre ta vraie base locale — c'est voulu pour la Phase 0.
import "dotenv/config"; // DOIT être la première ligne : charge DATABASE_URL avant Prisma
import assert from "node:assert";
import { prisma } from "@immo/database";
import { requireOrg } from "../middleware/requireOrg.js"; // .js — règle ESM déjà vue

function fakeContext(userId: string, orgId: string) {
  const req = {
    user: { id: userId, email: "test@immo.cm" },
    headers: { "x-org-id": orgId },
  } as any;

  const res = {
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  } as any;

  let nextCalled = false;
  return {
    req,
    res,
    next: () => {
      nextCalled = true;
    },
    wasNextCalled: () => nextCalled,
  };
}

async function main() {
  // Nettoyage : l'ordre compte — les enfants (memberships) avant
  // les parents (organizations) à cause des clés étrangères.
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  const ownerA = await prisma.user.create({
    data: {
      email: "a@test.cm",
      firstName: "Alice",
      lastName: "Kamga",
      role: "OWNER",
    },
  });
  const ownerB = await prisma.user.create({
    data: {
      email: "b@test.cm",
      firstName: "Bruno",
      lastName: "Njoya",
      role: "OWNER",
    },
  });

  // Convention à respecter partout : le propriétaire est AUSSI membre
  // de sa propre org (membership avec rôle OWNER).
  const orgA = await prisma.organization.create({
    data: {
      name: "Immeuble Kamga",
      ownerId: ownerA.id,
      memberships: { create: { userId: ownerA.id, role: "OWNER" } },
    },
  });
  const orgB = await prisma.organization.create({
    data: {
      name: "Immeuble Njoya",
      ownerId: ownerB.id,
      memberships: { create: { userId: ownerB.id, role: "OWNER" } },
    },
  });

  // Test 1 : A accède à SA propre org -> le middleware laisse passer
  const t1 = fakeContext(ownerA.id, orgA.id);
  await requireOrg(t1.req, t1.res, t1.next);
  assert.ok(t1.wasNextCalled(), "Échec : A devrait accéder à sa propre org");

  // Test 2 : A tente d'accéder à l'org de B -> 403
  const t2 = fakeContext(ownerA.id, orgB.id);
  await requireOrg(t2.req, t2.res, t2.next);
  assert.equal(
    t2.res.statusCode,
    403,
    "Échec : A ne doit pas accéder à l'org de B",
  );
  assert.ok(!t2.wasNextCalled());

  // Test 3 : org inexistante -> 403 également
  const t3 = fakeContext(ownerA.id, "org_inexistante");
  await requireOrg(t3.req, t3.res, t3.next);
  assert.equal(t3.res.statusCode, 403);

  console.log("✅ Isolation multi-tenant vérifiée : 3/3 tests passés");
}

main()
  .catch((e) => {
    console.error("❌ Test échoué :", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
