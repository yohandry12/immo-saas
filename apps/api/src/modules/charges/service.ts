import { prisma } from "@immo/database";
import type {
  CreateChargeBillInput,
  ListChargesQuery,
  MarkAllocationPaidInput,
} from "@immo/shared";
import { eventBus } from "../../lib/eventBus.js";

/** Convention : « introuvable » = n'existe pas OU appartient à une autre org. */
export class NotFoundError extends Error {
  constructor() {
    super("Ressource introuvable");
  }
}

/** Règle métier violée → 409. */
export class ConflictError extends Error {}

/**
 * Rôle : répartir un montant ENTIER en parts ENTIÈRES dont la somme est
 * exactement le total, au prorata des poids donnés.
 * Méthode « au plus fort reste » : parts tronquées d'abord, puis les
 * francs restants distribués un par un aux plus grandes parties
 * décimales. Jamais d'écart d'arrondi avec la facture réelle.
 */
function splitProportional(amount: number, weights: number[]): number[] {
  const totalW = weights.reduce((s, w) => s + w, 0);
  const exact = weights.map((w) => (amount * w) / totalW);
  const parts = exact.map((v) => Math.floor(v));
  let left = amount - parts.reduce((s, v) => s + v, 0);

  const byFrac = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  let k = 0;
  while (left > 0) {
    parts[byFrac[k % byFrac.length].i] += 1;
    k++;
    left--;
  }
  return parts;
}

/**
 * Rôle : entrer la facture une fois et la répartir automatiquement.
 * Seuls les appartements occupés (bail actif) participent : un
 * appartement vide ne paie pas sa part d'eau — le propriétaire absorbe.
 * Les parts créées sont un snapshot : elles ne bougeront plus.
 */
export async function createBill(orgId: string, input: CreateChargeBillInput) {
  const building = await prisma.building.findUnique({
    where: { id: input.buildingId },
  });
  if (!building || building.orgId !== orgId) throw new NotFoundError();

  const occupied = await prisma.unit.findMany({
    where: { buildingId: building.id, leases: { some: { endDate: null } } },
  });
  if (occupied.length === 0) {
    throw new ConflictError(
      "Aucun appartement occupé dans cet immeuble : rien à répartir.",
    );
  }

  let parts: { unitId: string; amount: number }[];

  if (input.rule === "CUSTOM") {
    const custom = input.customAllocations ?? [];
    const sum = custom.reduce((s, a) => s + a.amount, 0);
    if (sum !== input.amount) {
      throw new ConflictError(
        `La somme des parts (${sum}) ne correspond pas au montant de la facture (${input.amount}).`,
      );
    }
    const occupiedIds = new Set(occupied.map((u) => u.id));
    if (!custom.every((a) => occupiedIds.has(a.unitId))) {
      throw new ConflictError(
        "Une part vise un appartement inexistant ou non occupé dans cet immeuble.",
      );
    }
    parts = custom;
  } else {
    // EQUAL = poids 1 partout ; BY_AREA = surfaces ; BY_OCCUPANTS = occupants.
    const weights = occupied.map((u) =>
      input.rule === "BY_AREA"
        ? (u.surfaceM2 ?? 0)
        : input.rule === "BY_OCCUPANTS"
          ? u.occupants
          : 1,
    );
    if (weights.reduce((s, w) => s + w, 0) <= 0) {
      throw new ConflictError(
        "Impossible de répartir : surfaces ou occupants manquants. Utilisez EQUAL ou CUSTOM.",
      );
    }
    const amounts = splitProportional(input.amount, weights);
    parts = occupied.map((u, i) => ({ unitId: u.id, amount: amounts[i] }));
  }

  return prisma.chargeBill.create({
    data: {
      buildingId: building.id,
      type: input.type,
      amount: input.amount,
      period: input.period,
      rule: input.rule,
      allocations: { create: parts },
    },
    include: {
      allocations: { include: { unit: { select: { label: true } } } },
    },
  });
}

/**
 * Rôle : envoyer la facture répartie. L'envoi fige la répartition :
 * plus personne ne peut la modifier ensuite (principe du snapshot).
 */
export async function sendBill(orgId: string, billId: string) {
  const bill = await prisma.chargeBill.findUnique({
    where: { id: billId },
    include: {
      building: { select: { name: true, orgId: true } },
      allocations: true,
    },
  });
  if (!bill || bill.building.orgId !== orgId) throw new NotFoundError();
  if (bill.status === "SENT") {
    throw new ConflictError(
      "Cette facture est déjà envoyée : la répartition est figée.",
    );
  }

  const updated = await prisma.chargeBill.update({
    where: { id: billId },
    data: { status: "SENT" },
  });

  // Publier après commit : le dashboard apprend la facture à l'instant.
  eventBus.publish(orgId, {
    type: "BILL_SENT",
    payload: {
      buildingName: bill.building.name,
      type: bill.type,
      amount: bill.amount,
      period: bill.period,
      parts: bill.allocations.length,
    },
    createdAt: new Date().toISOString(),
  });

  return updated;
}

/**
 * Rôle : lister les factures communes du portefeuille, avec qui doit
 * quoi et qui a déjà réglé.
 */
export async function listBills(orgId: string, query: ListChargesQuery) {
  return prisma.chargeBill.findMany({
    where: {
      building: { orgId },
      ...(query.buildingId && { buildingId: query.buildingId }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      building: { select: { name: true } },
      allocations: { include: { unit: { select: { label: true } } } },
    },
  });
}

/**
 * Rôle : enregistrer qu'un locataire a réglé sa part. L'écriture part
 * AUSSI dans le journal des paiements (kind CHARGE), avec la période de
 * la facture : le journal reste l'unique source de vérité financière.
 */
export async function markAllocationPaid(
  orgId: string,
  billId: string,
  allocationId: string,
  input: MarkAllocationPaidInput,
  recordedById: string,
) {
  const bill = await prisma.chargeBill.findUnique({
    where: { id: billId },
    include: { building: { select: { orgId: true } }, allocations: true },
  });
  // Le nom est copié MAINTENANT : l'écriture le gardera même si
  // le compte de son auteur disparaît un jour.
  const recorder = await prisma.user.findUnique({
    where: { id: recordedById },
    select: { firstName: true, lastName: true },
  });
  if (!bill || bill.building.orgId !== orgId) throw new NotFoundError();

  const allocation = bill.allocations.find((a) => a.id === allocationId);
  if (!allocation) throw new NotFoundError();
  if (allocation.paid) throw new ConflictError("Cette part est déjà réglée.");

  const [unit, activeLease] = await Promise.all([
    prisma.unit.findUnique({ where: { id: allocation.unitId } }),
    // Rattachement au bail actif : le reçu appartient à CE locataire,
    // pas à l'appartement pour l'éternité.
    prisma.lease.findFirst({
      where: { unitId: allocation.unitId, endDate: null },
      select: { id: true },
    }),
  ]);

  // Transition CONDITIONNELLE : le check `allocation.paid` ci-dessus est
  // une lecture — deux requêtes simultanées le passent toutes les deux.
  // Le updateMany où paid=false garantit qu'UNE SEULE écrit le Payment ;
  // l'autre voit count = 0 et repart en 409, sans double écriture.
  const updated = await prisma.$transaction(async (tx) => {
    const marked = await tx.chargeAllocation.updateMany({
      where: { id: allocationId, paid: false },
      data: { paid: true },
    });
    if (marked.count === 0) {
      throw new ConflictError("Cette part est déjà réglée.");
    }

    await tx.payment.create({
      data: {
        orgId,
        unitId: allocation.unitId,
        leaseId: activeLease?.id ?? null,
        kind: "CHARGE",
        method: input.method,
        amount: allocation.amount,
        status: "CONFIRMED",
        recordedById,
        recordedByName: recorder
          ? `${recorder.firstName} ${recorder.lastName}`
          : null,
        paidAt: new Date(),
        // La part est rattachée au mois de la facture, pas au mois
        // du paiement : la vue « qui a payé juin » reste juste.
        periodFrom: bill.period,
        periodTo: bill.period,
      },
    });

    return tx.chargeAllocation.findUniqueOrThrow({
      where: { id: allocationId },
    });
  });

  eventBus.publish(orgId, {
    type: "PAYMENT_RECORDED",
    payload: {
      unitLabel: unit?.label,
      amount: allocation.amount,
      method: input.method,
      kind: "CHARGE",
    },
    createdAt: new Date().toISOString(),
  });

  return updated;
}
