import { randomUUID } from "node:crypto";
import { prisma } from "@immo/database";
import { eventBus } from "../../lib/eventBus.js";
import { getMomoClient } from "../../lib/momoClient.js";
import type {
  InitiateMomoPaymentInput,
  ListPaymentsQuery,
  RecordPaymentInput,
} from "@immo/shared";

/**
 * Même convention que buildings : « introuvable » couvre à la fois
 * « n'existe pas » et « appartient à une autre org » — on ne révèle
 * jamais l'existence des données d'autrui.
 */
export class NotFoundError extends Error {
  constructor() {
    super("Ressource introuvable");
  }
}

/**
 * Rôle : inscrire un paiement reçu « à la main » dans le journal,
 * et écrire en même temps l'événement que verra la diaspora.
 * Les deux écritures sont dans la même transaction : jamais un
 * paiement sans son événement, jamais l'inverse.
 *
 * @throws NotFoundError si l'appartement n'existe pas ou n'est pas dans cette org
 */
export async function recordPayment(
  orgId: string,
  recordedById: string,
  input: RecordPaymentInput,
) {
  // Défense en profondeur : on revérifie l'appartenance à l'org ici,
  // indépendamment du middleware. include building = l'org est dessus.
  const unit = await prisma.unit.findUnique({
    where: { id: input.unitId },
    include: { building: true },
  });
  // Le nom est copié MAINTENANT : l'écriture le gardera même si
  // le compte de son auteur disparaît un jour.
  const recorder = await prisma.user.findUnique({
    where: { id: recordedById },
    select: { firstName: true, lastName: true },
  });

  if (!unit || unit.building.orgId !== orgId) throw new NotFoundError();

  const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();

  // Le paiement est rattaché au BAIL actif, pas seulement à
  // l'appartement : c'est ce qui empêche un futur occupant de voir
  // les reçus de l'occupant actuel dans son historique locataire.
  const activeLease = await prisma.lease.findFirst({
    where: { unitId: unit.id, endDate: null },
    select: { id: true },
  });

  // Forme « tableau » du $transaction : les deux écritures sont
  // indépendantes l'une de l'autre (toutes les valeurs sont déjà
  // connues), donc on les envoie en un seul aller-retour base de données.
  const [payment] = await prisma.$transaction([
    prisma.payment.create({
      data: {
        orgId,
        unitId: unit.id,
        leaseId: activeLease?.id ?? null,
        kind: input.kind,
        method: input.method,
        amount: input.amount,
        status: "CONFIRMED",
        recordedById,
        recordedByName: recorder
          ? `${recorder.firstName} ${recorder.lastName}`
          : null,
        paidAt,
        // Normalisation : periodTo absent mais periodFrom présent =
        // le paiement couvre un seul mois.
        periodFrom: input.periodFrom ?? null,
        periodTo: input.periodTo ?? input.periodFrom ?? null,
      },
    }),
    prisma.activityEvent.create({
      data: {
        orgId,
        type: "PAYMENT_RECORDED",
        // Le payload porte ce que le dashboard affichera tel quel :
        // l'étiquette de l'appartement, pas juste un id illisible.
        payload: {
          unitLabel: unit.label,
          kind: input.kind,
          method: input.method,
          amount: input.amount,
          periodFrom: input.periodFrom ?? null,
          periodTo: input.periodTo ?? input.periodFrom ?? null,
        },
      },
    }),
  ]);

  // APRÈS le commit : un événement n'est annoncé que s'il est persisté.
  eventBus.publish(orgId, {
    type: "PAYMENT_RECORDED",
    payload: {
      unitLabel: unit.label,
      amount: input.amount,
      method: input.method,
    },
    createdAt: new Date().toISOString(),
  });

  return payment;
}

/**
 * Rôle : ouvrir un paiement Mobile Money. Crée l'écriture PENDING avec
 * une référence unique, demande le lien de paiement à l'agrégateur, et
 * renvoie le lien au front. L'agrégateur est appelé AVANT l'écriture :
 * s'il échoue, rien n'est inscrit.
 */
export async function initiateMomoPayment(
  orgId: string,
  input: InitiateMomoPaymentInput,
) {
  const unit = await prisma.unit.findUnique({
    where: { id: input.unitId },
    include: { building: true },
  });
  if (!unit || unit.building.orgId !== orgId) throw new NotFoundError();

  const amount = input.amount ?? unit.rentAmount;
  const reference = randomUUID();

  const client = getMomoClient();
  const { paymentUrl } = await client.initiate({
    reference,
    amount,
    payerPhone: input.payerPhone,
    description: `Loyer ${unit.label} — ${unit.building.name}`,
    method: input.method,
  });

  // Même règle que recordPayment : rattachement au bail actif.
  const activeLease = await prisma.lease.findFirst({
    where: { unitId: unit.id, endDate: null },
    select: { id: true },
  });

  const payment = await prisma.payment.create({
    data: {
      orgId,
      unitId: unit.id,
      leaseId: activeLease?.id ?? null,
      kind: "RENT",
      method: input.method,
      amount,
      status: "PENDING",
      externalRef: reference,
      periodFrom: input.periodFrom ?? null,
      periodTo: input.periodTo ?? input.periodFrom ?? null,
    },
  });

  return { paymentId: payment.id, reference, paymentUrl };
}

/**
 * Rôle : traiter l'appel de l'agrégateur. C'est la SEULE autorité de
 * confirmation : le téléphone du locataire ne prouve rien, ce webhook oui.
 * Idempotent (réflexe externalRef) : un webhook rejoué ne re-crédite pas.
 */
export async function confirmMomoPayment(reference: string, success: boolean) {
  const payment = await prisma.payment.findUnique({
    where: { externalRef: reference },
    include: { unit: { select: { label: true } } },
  });
  if (!payment) return { processed: false };

  if (payment.status !== "PENDING") {
    return { processed: false };
  }

  const newStatus = success ? ("CONFIRMED" as const) : ("FAILED" as const);

  // Transition CONDITIONNELLE : le updateMany n'écrit que si le paiement
  // est ENCORE en PENDING au moment du commit. Deux webhooks rejoués en
  // parallèle passent tous deux le check ci-dessus ; un seul gagne ici,
  // l'autre voit count = 0 et ne crée pas d'événement dupliqué.
  const won = await prisma.$transaction(async (tx) => {
    const updated = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: newStatus,
        paidAt: success ? new Date() : null,
      },
    });
    if (updated.count === 0) return false;

    await tx.activityEvent.create({
      data: {
        orgId: payment.orgId,
        type: success ? "PAYMENT_CONFIRMED" : "PAYMENT_FAILED",
        payload: {
          unitLabel: payment.unit.label,
          amount: payment.amount,
          method: payment.method,
        },
      },
    });
    return true;
  });

  if (!won) return { processed: false };

  eventBus.publish(payment.orgId, {
    type: success ? "PAYMENT_CONFIRMED" : "PAYMENT_FAILED",
    payload: {
      unitLabel: payment.unit.label,
      amount: payment.amount,
      method: payment.method,
    },
    createdAt: new Date().toISOString(),
  });

  return { processed: true, status: newStatus };
}

/**
 * Rôle : renvoyer le journal des paiements de l'org, du plus récent
 * au plus ancien, avec l'étiquette de l'appartement de chaque ligne.
 * Le where inclut TOUJOURS orgId : c'est lui qui rend la fuite
 * inter-organisations impossible, même avec un filtre unitId hostile.
 */
export async function listPayments(orgId: string, query: ListPaymentsQuery) {
  return prisma.payment.findMany({
    where: {
      orgId,
      // Filtres optionnels : présents seulement si fournis.
      ...(query.unitId && { unitId: query.unitId }),
      ...(query.kind && { kind: query.kind }),
      ...(query.status && { status: query.status }),
    },
    orderBy: { paidAt: "desc" },
    include: { unit: { select: { label: true } } },
    take: query.limit,
    skip: query.offset,
  });
}
