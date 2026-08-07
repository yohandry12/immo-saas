import { prisma } from "@immo/database";
import type { TenantHomeResponse } from "@immo/shared";

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
export async function getTenantHome(
  tenantId: string,
): Promise<TenantHomeResponse> {
  const period = currentPeriod();

  const leases = await prisma.lease.findMany({
    where: { tenantId, endDate: null },
    include: {
      unit: { include: { building: { select: { name: true, city: true } } } },
    },
  });

  const leaseIds = leases.map((l) => l.id);
  const unitIds = leases.map((l) => l.unitId);
  const [rentPayments, unpaidCharges] = await Promise.all([
    prisma.payment.findMany({
      // Scope par BAIL, pas par appartement : les paiements d'un
      // occupant précédent du même appartement ne comptent pas.
      // leaseId null = écritures d'avant le rattachement systématique ;
      // on les borne alors à la période du bail (filtre ci-dessous).
      where: {
        kind: "RENT",
        status: "CONFIRMED",
        OR: [
          { leaseId: { in: leaseIds } },
          { leaseId: null, unitId: { in: unitIds } },
        ],
      },
    }),
    prisma.chargeAllocation.findMany({
      where: { unitId: { in: unitIds }, paid: false, bill: { status: "SENT" } },
      include: { bill: { select: { type: true, period: true } } },
    }),
  ]);

  const belongsToLease = (
    p: (typeof rentPayments)[number],
    lease: (typeof leases)[number],
  ) => {
    if (p.leaseId) return p.leaseId === lease.id;
    if (p.unitId !== lease.unitId) return false;
    // Héritage sans leaseId : le paiement doit dater du bail en cours.
    return (p.paidAt ?? p.createdAt) >= lease.startDate;
  };

  return {
    period,
    leases: leases.map((lease) => ({
      id: lease.id,
      unitLabel: lease.unit.label,
      buildingName: lease.unit.building.name,
      city: lease.unit.building.city,
      rentAmount: lease.rentAmount,
      rentPaidForCurrentMonth: rentPayments.some(
        (p) => belongsToLease(p, lease) && covers(p, period),
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
 * Rôle : l'historique complet — tous les paiements confirmés des BAUX
 * du locataire (actifs ET passés), du plus récent au plus ancien.
 * Scope par bail, jamais par appartement : un appartement a plusieurs
 * occupants dans sa vie, et les reçus des autres ne le regardent pas.
 * Les écritures d'avant le rattachement (leaseId null) sont bornées
 * aux dates du bail correspondant.
 */
export async function getTenantPayments(tenantId: string) {
  const leases = await prisma.lease.findMany({
    where: { tenantId },
    select: { id: true, unitId: true, startDate: true, endDate: true },
  });
  if (leases.length === 0) return [];

  const leaseIds = leases.map((l) => l.id);
  const unitIds = leases.map((l) => l.unitId);

  const payments = await prisma.payment.findMany({
    where: {
      status: "CONFIRMED",
      OR: [
        { leaseId: { in: leaseIds } },
        { leaseId: null, unitId: { in: unitIds } },
      ],
    },
    orderBy: { paidAt: "desc" },
    include: { unit: { select: { label: true } } },
  });

  // Filet héritage : un paiement sans leaseId n'est un reçu du locataire
  // que s'il tombe pendant l'un de SES baux sur cet appartement.
  return payments.filter((p) => {
    if (p.leaseId) return true;
    const at = p.paidAt ?? p.createdAt;
    return leases.some(
      (l) =>
        l.unitId === p.unitId &&
        at >= l.startDate &&
        (l.endDate === null || at <= l.endDate),
    );
  });
}
