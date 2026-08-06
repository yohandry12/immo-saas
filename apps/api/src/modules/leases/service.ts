import { prisma, Prisma } from "@immo/database";
import { normalizePhone } from "@immo/shared";
import { eventBus } from "../../lib/eventBus.js";
import type {
  CreateLeaseInput,
  ListLeasesQuery,
  TerminateLeaseInput,
} from "@immo/shared";

/** Convention : « introuvable » = n'existe pas OU appartient à une autre org. */
export class NotFoundError extends Error {
  constructor() {
    super("Ressource introuvable");
  }
}

/** Règle métier violée (bail actif déjà présent, bail déjà terminé...) → 409. */
export class ConflictError extends Error {}

/**
 * Rôle : signer le bail d'un appartement du portefeuille.
 * Applique la règle « un seul bail actif par appartement », fige le
 * loyer contractuel, et calcule le total d'entrée attendu à la
 * camerounaise : mois d'avance × loyer + caution.
 *
 * @throws NotFoundError appartement inexistant ou hors de l'org
 * @throws ConflictError un bail actif existe déjà sur cet appartement
 */
export async function createLease(orgId: string, input: CreateLeaseInput) {
  const unit = await prisma.unit.findUnique({
    where: { id: input.unitId },
    include: { building: true },
  });
  if (!unit || unit.building.orgId !== orgId) throw new NotFoundError();

  const active = await prisma.lease.findFirst({
    where: { unitId: unit.id, endDate: null },
  });
  if (active) {
    throw new ConflictError("Un bail actif existe déjà pour cet appartement.");
  }

  const rentAmount = input.rentAmount ?? unit.rentAmount;
  const depositAmount = input.depositAmount ?? 0;
  // Valeur DÉRIVÉE : calculée, jamais stockée — ses composantes
  // (avance, loyer contractuel, caution) sont déjà dans le bail.
  const expectedMoveInTotal = input.advanceMonths * rentAmount + depositAmount;

  let lease;
  try {
    [lease] = await prisma.$transaction([
      prisma.lease.create({
        data: {
          unitId: unit.id,
          tenantName: input.tenantName,
          tenantPhone: normalizePhone(input.tenantPhone),
          rentAmount,
          startDate: input.startDate ? new Date(input.startDate) : new Date(),
          endDate: input.endDate ? new Date(input.endDate) : null,
          advanceMonths: input.advanceMonths,
          depositAmount: input.depositAmount ?? null,
        },
      }),
      prisma.activityEvent.create({
        data: {
          orgId,
          type: "LEASE_SIGNED",
          payload: {
            unitLabel: unit.label,
            tenantName: input.tenantName,
            advanceMonths: input.advanceMonths,
            depositAmount,
            expectedMoveInTotal,
          },
        },
      }),
    ]);
  } catch (e) {
    // P2002 sur l'index partiel Lease_one_active_per_unit : deux créations
    // simultanées ont passé le findFirst ci-dessus — PostgreSQL tranche.
    if (
      e instanceof Prisma.PrismaClientKnownRequestError &&
      e.code === "P2002"
    ) {
      throw new ConflictError(
        "Un bail actif existe déjà pour cet appartement.",
      );
    }
    throw e;
  }

  eventBus.publish(orgId, {
    type: "LEASE_SIGNED",
    payload: {
      unitLabel: unit.label,
      tenantName: input.tenantName,
      expectedMoveInTotal,
    },
    createdAt: new Date().toISOString(),
  });

  return { ...lease, expectedMoveInTotal };
}

/**
 * Rôle : lister les baux du portefeuille, avec l'appartement et
 * l'immeuble de chacun. Filtre optionnel actifs/terminés.
 * L'isolation passe par le where imbriqué unit -> building -> orgId :
 * aucune requête ne sort jamais du portefeuille.
 */
export async function listLeases(orgId: string, query: ListLeasesQuery) {
  return prisma.lease.findMany({
    where: {
      unit: { building: { orgId } },
      ...(query.active === "true" && { endDate: null }),
      ...(query.active === "false" && { endDate: { not: null } }),
    },
    orderBy: { startDate: "desc" },
    include: {
      unit: { select: { label: true, building: { select: { name: true } } } },
    },
    take: query.limit,
    skip: query.offset,
  });
}

/**
 * Rôle : renvoyer un bail en détail. Deuxième couche d'isolation :
 * le check orgId se fait ici, pas seulement au middleware.
 */
export async function getLease(orgId: string, leaseId: string) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: {
      id: true,
      tenantName: true,
      tenantPhone: true,
      rentAmount: true,
      startDate: true,
      endDate: true,
      advanceMonths: true,
      depositAmount: true,
      unit: {
        select: {
          id: true,
          label: true,
          building: { select: { name: true, city: true, orgId: true } },
        },
      },
    },
  });

  if (!lease || lease.unit.building.orgId !== orgId) throw new NotFoundError();
  return lease;
}

/**
 * Rôle : mettre fin à un bail (date fournie ou aujourd'hui).
 * L'appartement redevient louable immédiatement, l'historique reste.
 *
 * @throws ConflictError si le bail est déjà terminé
 */
export async function terminateLease(
  orgId: string,
  leaseId: string,
  input: TerminateLeaseInput,
) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    select: {
      id: true,
      endDate: true,
      tenantName: true,
      unit: {
        select: {
          id: true,
          label: true,
          building: { select: { orgId: true } },
        },
      },
    },
  });
  if (!lease || lease.unit.building.orgId !== orgId) throw new NotFoundError();

  if (lease.endDate !== null) {
    throw new ConflictError("Ce bail est déjà terminé.");
  }

  const endDate = input.endDate ? new Date(input.endDate) : new Date();

  const [updated] = await prisma.$transaction([
    prisma.lease.update({ where: { id: leaseId }, data: { endDate } }),
    prisma.activityEvent.create({
      data: {
        orgId,
        type: "LEASE_TERMINATED",
        payload: { unitLabel: lease.unit.label, tenantName: lease.tenantName },
      },
    }),
  ]);

  eventBus.publish(orgId, {
    type: "LEASE_TERMINATED",
    payload: {
      unitLabel: lease.unit.label,
      tenantName: lease.tenantName,
    },
    createdAt: new Date().toISOString(),
  });

  return updated;
}
