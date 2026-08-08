"use client";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatFCFA } from "@/lib/format";
import { tenantService } from "@/services/tenant.service";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";
import { Table, Th, Td, Tr } from "@/components/ui/Table";
import { errorMessage } from "@/lib/api";

type TenantHome = {
  period: string;
  leases: {
    id: string;
    unitLabel: string;
    buildingName: string;
    city: string;
    rentAmount: number;
    rentPaidForCurrentMonth: boolean;
    unpaidCharges: { id: string; type: string; period: string; amount: number }[];
  }[];
};

const CHARGE_TYPES: Record<string, string> = {
  WATER: "Eau",
  ELECTRICITY: "Électricité",
  OTHER: "Autre",
};
const METHODS: Record<string, string> = {
  CASH: "Espèces",
  MOMO: "MTN MoMo",
  ORANGE_MONEY: "Orange Money",
  BANK: "Virement",
};

// Espace locataire : mon logement, mon loyer du mois, mes reçus.
export default function LocatairePage() {
  const home = useQuery<TenantHome>({
    queryKey: ["tenant-home"],
    queryFn: tenantService.home,
  });
  const payments = useQuery({
    queryKey: ["tenant-payments"],
    queryFn: tenantService.payments,
  });

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-24">
      <h1 className="text-heading font-bold text-hof">Mon logement</h1>

      {home.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Impossible de charger : {errorMessage(home.error)}
          </p>
          <Button variant="ghost" onClick={() => home.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {home.isPending && (
        <Card className="flex flex-col gap-12 p-24" aria-busy="true">
          <Skeleton className="h-24 w-[60%]" />
          <Skeleton className="h-16 w-[40%]" />
        </Card>
      )}

      {home.isSuccess && home.data.leases.length === 0 && (
        <Card>
          <EmptyState
            title="Aucun bail rattaché à votre compte"
            hint="Votre propriétaire doit confirmer le rattachement de votre compte à votre bail. Vérifiez avec lui que votre numéro de téléphone est bien celui du bail."
          />
        </Card>
      )}

      {home.data?.leases.map((l) => (
        <Card key={l.id} className="flex flex-col gap-12">
          <div className="flex flex-wrap items-start justify-between gap-12">
            <div>
              <p className="text-ui font-semibold text-hof">
                {l.buildingName} · {l.unitLabel}
              </p>
              <p className="text-label text-foggy">{l.city}</p>
            </div>
            {l.rentPaidForCurrentMonth ? (
              <Badge tone="success">Loyer {home.data.period} payé</Badge>
            ) : (
              <Badge tone="warning">Loyer {home.data.period} à payer</Badge>
            )}
          </div>
          <p className="text-body text-hof">
            Loyer mensuel :{" "}
            <span className="font-semibold tabular-nums">
              {formatFCFA(l.rentAmount)}
            </span>
          </p>
          {l.unpaidCharges.length > 0 && (
            <div className="rounded-lg bg-faint p-12">
              <p className="mb-8 text-label font-medium text-hof">
                Charges à régler
              </p>
              <ul className="flex flex-col gap-4">
                {l.unpaidCharges.map((c) => (
                  <li
                    key={c.id}
                    className="flex justify-between text-body text-hof"
                  >
                    <span>
                      {CHARGE_TYPES[c.type] ?? c.type} · {c.period}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatFCFA(c.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      ))}

      <section aria-labelledby="titre-recus">
        <h2
          id="titre-recus"
          className="mb-12 text-heading-sm font-medium text-hof"
        >
          Mes reçus
        </h2>
        <Card className="p-4">
          {payments.isPending ? (
            <div className="flex flex-col gap-12 p-12" aria-busy="true">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-[70%]" />
            </div>
          ) : (payments.data ?? []).length === 0 ? (
            <EmptyState
              title="Aucun paiement confirmé"
              hint="Vos paiements de loyer et de charges apparaîtront ici : ce sont vos preuves."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Appartement</Th>
                  <Th>Méthode</Th>
                  <Th className="text-right">Montant</Th>
                </tr>
              </thead>
              <tbody>
                {(payments.data ?? []).map((p) => (
                  <Tr key={p.id}>
                    <Td className="whitespace-nowrap text-foggy">
                      {formatDate(p.paidAt ?? p.createdAt)}
                    </Td>
                    <Td className="font-medium">{p.unit?.label ?? "?"}</Td>
                    <Td className="text-foggy">{METHODS[p.method]}</Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {formatFCFA(p.amount)}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </section>
    </div>
  );
}
