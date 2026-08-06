import bcrypt from "bcryptjs";
import { prisma } from "@immo/database";
import { normalizePhone } from "@immo/shared";
import type { InviteManagerInput } from "@immo/shared";

export class ConflictError extends Error {}
export class NotFoundError extends Error {
  constructor() {
    super("Ressource introuvable");
  }
}

/**
 * Rôle : créer le compte de l'agent de terrain (s'il n'existe pas) et
 * l'attacher au portefeuille avec le rôle MANAGER. Au MVP, c'est le
 * propriétaire qui crée le compte et transmet les identifiants —
 * l'invitation par SMS/OTP viendra plus tard.
 *
 * @throws ConflictError si la personne est déjà membre du portefeuille
 */
export async function inviteManager(orgId: string, input: InviteManagerInput) {
  const phone = input.phone ? normalizePhone(input.phone) : null;
  const where = input.email ? { email: input.email } : { phone: phone! };

  let user = await prisma.user.findUnique({ where });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email: input.email ?? null,
        phone,
        passwordHash: await bcrypt.hash(input.password, 10),
        firstName: input.firstName,
        lastName: input.lastName,
        role: "MANAGER",
      },
    });
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: user.id, orgId } },
  });
  if (existing) {
    throw new ConflictError("Cette personne est déjà membre du portefeuille.");
  }

  return prisma.membership.create({
    data: { userId: user.id, orgId, role: "MANAGER" },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true, phone: true },
      },
    },
  });
}
/** Rôle : la liste des personnes du portefeuille, pour le propriétaire. */
export async function listMembers(orgId: string) {
  return prisma.membership.findMany({
    where: { orgId },
    include: {
      user: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
}
export async function revokeMember(
  orgId: string,
  requesterId: string,
  userId: string,
) {
  if (userId === requesterId) {
    throw new ConflictError("Vous ne pouvez pas révoquer votre propre accès.");
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId } },
  });
  if (!membership) throw new NotFoundError();
  if (membership.role === "OWNER") {
    throw new ConflictError(
      "Le propriétaire du portefeuille ne peut pas être révoqué.",
    );
  }

  await prisma.membership.delete({ where: { id: membership.id } });
}
