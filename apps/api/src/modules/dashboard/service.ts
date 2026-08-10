import { prisma } from "@immo/database";
import type { Payment } from "@immo/database";

/**
 * Rôle : la photo du mois pour le propriétaire.
 * Attendu = somme des loyers contractuels des baux actifs.
 * Encaissé = somme des paiements loyer qui COUVRENT le mois demandé
 * (une avance de 6 mois compte pour chacun des 6 mois).
 * Le reste en découle. Calcul en mémoire : lisible maintenant,
 * migrable en SQL plus tard si le volume l'exige.
 */
export async function getSummary(orgId: string, period: string) {
  const [units, payments] = await Promise.all([
    prisma.unit.findMany({
      where: { building: { orgId } },
      // On charge TOUS les baux (pas seulement les actifs) : la vigueur au
      // mois demandé se décide en mémoire, sinon un bail terminé disparaît de
      // l'historique et un bail futur pollue les mois antérieurs.
      include: {
        leases: {
          select: {
            id: true,
            rentAmount: true,
            tenantName: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    }),
    prisma.payment.findMany({ where: { orgId, status: "CONFIRMED" } }),
  ]);

  const monthOf = (d: Date) => d.toISOString().slice(0, 7);
  // Un paiement couvre le mois demandé si periodFrom <= mois <= periodTo,
  // les bornes absentes retombant sur le mois de paidAt.
  const covers = (p: Payment) => {
    const from = p.periodFrom ?? monthOf(p.paidAt ?? p.createdAt);
    const to = p.periodTo ?? from;
    return from <= period && period <= to;
  };

  const rentPayments = payments.filter((p) => p.kind === "RENT");

  let expectedRent = 0;
  let occupied = 0;
  const unpaidUnits: {
    unitId: string;
    leaseId: string;
    label: string;
    tenantName: string | null;
    due: number;
    daysLate: number;
  }[] = [];

  // Ancienneté du retard : le loyer est dû en début de mois (convention
  // camerounaise, pas de jour d'échéance configurable). On compte donc
  // les jours écoulés depuis le 1er du mois demandé — mais seulement
  // pour le mois COURANT : un impayé d'un mois passé est « en retard »
  // d'un nombre de jours qui n'a plus de sens à afficher au jour près.
  const now = new Date();
  const [py, pm] = period.split("-").map(Number);
  const firstOfPeriod = new Date(Date.UTC(py, pm - 1, 1));
  const isCurrent = period === monthOf(now);
  const daysSinceDue = isCurrent
    ? Math.max(
        0,
        Math.floor((now.getTime() - firstOfPeriod.getTime()) / 86_400_000),
      )
    : // Mois passé : retard « plein » = nombre de jours du mois.
      new Date(Date.UTC(py, pm, 0)).getUTCDate();

  // Un bail est « en vigueur » le mois demandé s'il a commencé (au mois
  // près) et n'est pas terminé avant. La base garantit un seul bail ACTIF
  // par appartement, mais pas l'absence de chevauchement entre baux passés :
  // en cas d'ambiguïté, on prend le plus récemment démarré.
  const inForce = (l: { startDate: Date; endDate: Date | null }) =>
    monthOf(l.startDate) <= period &&
    (l.endDate === null || period <= monthOf(l.endDate));

  for (const unit of units) {
    const lease =
      unit.leases
        .filter(inForce)
        .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0] ?? null;
    if (!lease) continue; // appartement vide CE mois-là : ni attendu, ni impayé
    occupied += 1;
    expectedRent += lease.rentAmount;

    const covered = rentPayments
      .filter((p) => p.unitId === unit.id && covers(p))
      .reduce((sum, p) => sum + p.amount, 0);

    if (covered < lease.rentAmount) {
      unpaidUnits.push({
        unitId: unit.id,
        leaseId: lease.id,
        label: unit.label,
        tenantName: lease.tenantName,
        due: lease.rentAmount - covered,
        daysLate: daysSinceDue,
      });
    }
  }

  const collectedRent = rentPayments
    .filter(covers)
    .reduce((s, p) => s + p.amount, 0);
  const depositsHeld = payments
    .filter((p) => p.kind === "DEPOSIT")
    .reduce((s, p) => s + p.amount, 0);

  // --- Point de comparaison : le MÊME jour du mois précédent ---
  // « bon » n'a de sens que relatif. On compare l'encaissé cumulé à la
  // même date : combien était rentré au 8 du mois dernier ? Le front en
  // tire « en avance » / « en retard ».
  const prevPeriod = shiftMonth(period, -1);
  // Jour du mois de la période demandée : aujourd'hui si c'est le mois
  // courant, sinon le mois entier (fin de mois) pour une comparaison juste.
  // `now` et `isCurrent` sont déjà calculés plus haut (retard des impayés).
  const cutoffDay = isCurrent ? now.getUTCDate() : 31;

  const inForcePrev = (l: { startDate: Date; endDate: Date | null }) =>
    monthOf(l.startDate) <= prevPeriod &&
    (l.endDate === null || prevPeriod <= monthOf(l.endDate));
  const prevExpected = units.reduce((sum, u) => {
    const l = u.leases
      .filter(inForcePrev)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];
    return sum + (l ? l.rentAmount : 0);
  }, 0);
  const prevCollected = rentPayments
    .filter((p) => {
      const from = p.periodFrom ?? monthOf(p.paidAt ?? p.createdAt);
      const to = p.periodTo ?? from;
      if (!(from <= prevPeriod && prevPeriod <= to)) return false;
      // Cumul « au même jour » : le paiement doit avoir été encaissé
      // au plus tard le cutoffDay du mois précédent.
      const paid = p.paidAt ?? p.createdAt;
      return paid.getUTCDate() <= cutoffDay;
    })
    .reduce((s, p) => s + p.amount, 0);

  // --- Tendance : encaissé de chacun des 6 derniers mois ---
  // Réutilise les paiements déjà chargés (aucune requête de plus). Le
  // dernier point est le mois demandé, pour que le sparkline se termine
  // sur le chiffre du héros.
  const trend = Array.from({ length: 6 }, (_, i) => {
    const p = shiftMonth(period, i - 5);
    const collected = rentPayments
      .filter((pay) => {
        const from = pay.periodFrom ?? monthOf(pay.paidAt ?? pay.createdAt);
        const to = pay.periodTo ?? from;
        return from <= p && p <= to;
      })
      .reduce((s, pay) => s + pay.amount, 0);
    return { period: p, collectedRent: collected };
  });

  return {
    period,
    expectedRent,
    collectedRent,
    // max(…, 0) : une avance ne doit jamais produire un « trop perçu » négatif.
    outstandingRent: Math.max(expectedRent - collectedRent, 0),
    depositsHeld,
    occupancy: {
      total: units.length,
      occupied,
      rate: units.length ? occupied / units.length : 0,
    },
    unpaidUnits,
    previousAtSameDay: {
      collectedRent: prevCollected,
      expectedRent: prevExpected,
    },
    trend,
  };
}

/** Décale une période "AAAA-MM" de n mois (n négatif = passé). */
function shiftMonth(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Rôle : les derniers événements du portefeuille, pour reconstituer
 * l'historique à l'ouverture de page avant de brancher le flux SSE.
 */
export async function getActivity(orgId: string, limit = 20) {
  return prisma.activityEvent.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
