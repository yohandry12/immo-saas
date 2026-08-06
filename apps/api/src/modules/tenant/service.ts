import { prisma } from "@immo/database";

const currentPeriod = () => new Date().toISOString().slice(0, 7);

// Même logique de couverture que le dashboard : un paiement couvre
// un mois si periodFrom <= mois <= periodTo (défaut : mois de paidAt).
function covers(
  p: {
    periodFrom: string | null;
    periodTo: string | null;
    paidAt: Date | null;
    createdAt: Date;
  },
  period: string,
) {
  const from =
    p.periodFrom ?? (p.paidAt ?? p.createdAt).toISOString().slice(0, 7);
  const to = p.periodTo ?? from;
  return from <= period && period <= to;
}

/**
 * Rôle : l'écran « mon chez-moi » du locataire. Pour chaque bail actif :
 * l'appartement, le loyer contractuel, si le mois courant est payé, et
 * les parts de charges envoyées mais pas encore réglées.
 * Scope par identité : tout est filtré sur tenantId, jamais sur une org.
 */
export async function getTenantHome(tenantId: string) {
  const period = currentPeriod();

  const leases = await prisma.lease.findMany({
    where: { tenantId, endDate: null },
    include: {
      unit: { include: { building: { select: { name: true, city: true } } } },
    },
  });

  const unitIds = leases.map((l) => l.unitId);
  const [rentPayments, unpaidCharges] = await Promise.all([
    prisma.payment.findMany({
      where: { unitId: { in: unitIds }, kind: "RENT", status: "CONFIRMED" },
    }),
    prisma.chargeAllocation.findMany({
      where: { unitId: { in: unitIds }, paid: false, bill: { status: "SENT" } },
      include: { bill: { select: { type: true, period: true } } },
    }),
  ]);

  return {
    period,
    leases: leases.map((lease) => ({
      id: lease.id,
      unitLabel: lease.unit.label,
      buildingName: lease.unit.building.name,
      city: lease.unit.building.city,
      rentAmount: lease.rentAmount,
      rentPaidForCurrentMonth: rentPayments.some(
        (p) => p.unitId === lease.unitId && covers(p, period),
      ),
      unpaidCharges: unpaidCharges
        .filter((a) => a.unitId === lease.unitId)
        .map((a) => ({
          id: a.id,
          type: a.bill.type,
          period: a.bill.period,
          amount: a.amount,
        })),
    })),
  };
}

/**
 * Rôle : l'historique complet — tous les paiements confirmés des
 * appartements que le locataire a occupés (baux actifs ET passés),
 * du plus récent au plus ancien. Ce sont ses reçus.
 */
export async function getTenantPayments(tenantId: string) {
  const leases = await prisma.lease.findMany({
    where: { tenantId },
    select: { unitId: true },
  });
  const unitIds = leases.map((l) => l.unitId);
  if (unitIds.length === 0) return [];

  return prisma.payment.findMany({
    where: { unitId: { in: unitIds }, status: "CONFIRMED" },
    orderBy: { paidAt: "desc" },
    include: { unit: { select: { label: true } } },
  });
}
