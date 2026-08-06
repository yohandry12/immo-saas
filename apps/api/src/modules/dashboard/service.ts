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
      // include filtré : ne ramène que les baux ACTIFS par appartement.
      include: {
        leases: {
          where: { endDate: null },
          select: {
            id: true,
            rentAmount: true,
            tenantName: true,
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
    label: string;
    tenantName: string | null;
    due: number;
  }[] = [];

  for (const unit of units) {
    const lease = unit.leases[0] ?? null;
    if (!lease) continue; // appartement vide : ni attendu, ni impayé
    occupied += 1;
    expectedRent += lease.rentAmount;

    const covered = rentPayments
      .filter((p) => p.unitId === unit.id && covers(p))
      .reduce((sum, p) => sum + p.amount, 0);

    if (covered < lease.rentAmount) {
      unpaidUnits.push({
        unitId: unit.id,
        label: unit.label,
        tenantName: lease.tenantName,
        due: lease.rentAmount - covered,
      });
    }
  }

  const collectedRent = rentPayments
    .filter(covers)
    .reduce((s, p) => s + p.amount, 0);
  const depositsHeld = payments
    .filter((p) => p.kind === "DEPOSIT")
    .reduce((s, p) => s + p.amount, 0);

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
  };
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
