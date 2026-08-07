"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { errorMessage } from "@/lib/api";
import { formatDate, formatFCFA } from "@/lib/format";
import { buildingsService } from "@/services/buildings.service";
import { paymentsService } from "@/services/payments.service";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";
import { Table, Th, Td, Tr } from "@/components/ui/Table";

const KINDS = { RENT: "Loyer", CHARGE: "Charge", DEPOSIT: "Caution" } as const;
const METHODS = {
  CASH: "Espèces",
  MOMO: "MTN MoMo",
  ORANGE_MONEY: "Orange Money",
  BANK: "Virement",
} as const;
const STATUS: Record<
  string,
  { label: string; tone: "success" | "warning" | "danger" }
> = {
  CONFIRMED: { label: "Confirmé", tone: "success" },
  PENDING: { label: "En attente", tone: "warning" },
  FAILED: { label: "Échoué", tone: "danger" },
};

const emptyRecord = {
  unitId: "",
  kind: "RENT",
  method: "CASH",
  amount: "",
  periodFrom: "",
  periodTo: "",
};
const emptyMomo = { unitId: "", method: "MOMO", payerPhone: "", amount: "" };

export default function PaiementsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({ unitId: "", kind: "", status: "" });
  const [recordOpen, setRecordOpen] = useState(false);
  const [momoOpen, setMomoOpen] = useState(false);
  const [recordForm, setRecordForm] = useState(emptyRecord);
  const [momoForm, setMomoForm] = useState(emptyMomo);
  const [formError, setFormError] = useState("");
  const [momoUrl, setMomoUrl] = useState("");

  // Les immeubles portent les units des sélecteurs (filtre + formulaires).
  const buildings = useQuery({
    queryKey: ["buildings-units"],
    queryFn: async () => {
      const list = await buildingsService.list();
      return Promise.all(list.map((b) => buildingsService.getById(b.id)));
    },
  });

  const allUnits = useMemo(
    () =>
      (buildings.data ?? []).flatMap((b) =>
        (b.units ?? []).map((u) => ({
          id: u.id,
          label: `${b.name} · ${u.label}`,
          rentAmount: u.leases?.[0]?.rentAmount ?? u.rentAmount,
        })),
      ),
    [buildings.data],
  );

  const payments = useQuery({
    queryKey: ["payments", filters],
    queryFn: () =>
      paymentsService.list({
        ...(filters.unitId && { unitId: filters.unitId }),
        ...(filters.kind && { kind: filters.kind }),
        ...(filters.status && { status: filters.status }),
      }),
    // Un paiement MoMo PENDING se confirme par webhook : on re-vérifie
    // tant qu'il y en a, on arrête dès que tout est stable.
    refetchInterval: (q) =>
      q.state.data?.some((p) => p.status === "PENDING") ? 15000 : false,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
  };

  const record = useMutation({
    mutationFn: () =>
      paymentsService.record({
        unitId: recordForm.unitId,
        kind: recordForm.kind as "RENT" | "CHARGE" | "DEPOSIT",
        method: recordForm.method as
          | "CASH"
          | "MOMO"
          | "ORANGE_MONEY"
          | "BANK",
        amount: Number(recordForm.amount),
        ...(recordForm.periodFrom && { periodFrom: recordForm.periodFrom }),
        ...(recordForm.periodTo && { periodTo: recordForm.periodTo }),
      }),
    onSuccess: () => {
      invalidate();
      setRecordOpen(false);
      setRecordForm(emptyRecord);
      setFormError("");
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const momo = useMutation({
    mutationFn: () =>
      paymentsService.initiateMomo({
        unitId: momoForm.unitId,
        method: momoForm.method as "MOMO" | "ORANGE_MONEY",
        payerPhone: momoForm.payerPhone,
        ...(momoForm.amount && { amount: Number(momoForm.amount) }),
      }),
    onSuccess: (d) => {
      invalidate();
      setMomoUrl(d.paymentUrl);
      setFormError("");
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const list = payments.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-24">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <h1 className="text-heading font-bold text-hof">Paiements</h1>
        <div className="flex gap-12">
          <Button
            variant="ghost"
            onClick={() => {
              setFormError("");
              setMomoUrl("");
              setMomoForm(emptyMomo);
              setMomoOpen(true);
            }}
          >
            Encaisser par Mobile Money
          </Button>
          <Button
            onClick={() => {
              setFormError("");
              setRecordForm(emptyRecord);
              setRecordOpen(true);
            }}
          >
            Enregistrer un paiement
          </Button>
        </div>
      </div>

      {/* ---- Filtres ---- */}
      <div className="flex flex-wrap gap-12">
        <Select
          aria-label="Filtrer par appartement"
          value={filters.unitId}
          onChange={(e) =>
            setFilters((f) => ({ ...f, unitId: e.target.value }))
          }
          className="w-auto min-w-[200px]"
        >
          <option value="">Tous les appartements</option>
          {allUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par type"
          value={filters.kind}
          onChange={(e) => setFilters((f) => ({ ...f, kind: e.target.value }))}
          className="w-auto"
        >
          <option value="">Tous les types</option>
          {Object.entries(KINDS).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrer par statut"
          value={filters.status}
          onChange={(e) =>
            setFilters((f) => ({ ...f, status: e.target.value }))
          }
          className="w-auto"
        >
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS).map(([v, s]) => (
            <option key={v} value={v}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {payments.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Impossible de charger les paiements : {errorMessage(payments.error)}
          </p>
          <Button variant="ghost" onClick={() => payments.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {payments.isPending && (
        <Card className="flex flex-col gap-12 p-24" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-[85%]" />
          <Skeleton className="h-16 w-[92%]" />
        </Card>
      )}

      {payments.isSuccess && list.length === 0 && (
        <Card>
          <EmptyState
            title="Aucun paiement trouvé"
            hint={
              filters.unitId || filters.kind || filters.status
                ? "Aucune écriture ne correspond à ces filtres."
                : "Enregistrez un loyer reçu en espèces, ou envoyez un lien Mobile Money au locataire."
            }
          />
        </Card>
      )}

      {list.length > 0 && (
        <Card className="p-4">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Appartement</Th>
                <Th>Type</Th>
                <Th>Méthode</Th>
                <Th className="text-right">Montant</Th>
                <Th>Statut</Th>
                <Th>Enregistré par</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const st = STATUS[p.status] ?? STATUS.PENDING;
                return (
                  <Tr key={p.id}>
                    <Td className="whitespace-nowrap text-foggy">
                      {formatDate(p.paidAt ?? p.createdAt)}
                    </Td>
                    <Td className="font-medium">{p.unit?.label ?? "?"}</Td>
                    <Td>
                      {KINDS[p.kind]}
                      {p.periodFrom && (
                        <span className="text-[12px] text-foggy">
                          {" "}
                          ({p.periodFrom}
                          {p.periodTo && p.periodTo !== p.periodFrom
                            ? ` → ${p.periodTo}`
                            : ""}
                          )
                        </span>
                      )}
                    </Td>
                    <Td className="text-foggy">{METHODS[p.method]}</Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {formatFCFA(p.amount)}
                    </Td>
                    <Td>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </Td>
                    <Td className="text-foggy">{p.recordedByName ?? "—"}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ---- Modale : enregistrement manuel ---- */}
      <Modal
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="Enregistrer un paiement"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            record.mutate();
          }}
          className="flex flex-col gap-16"
        >
          <Select
            label="Appartement"
            value={recordForm.unitId}
            onChange={(e) => {
              const unit = allUnits.find((u) => u.id === e.target.value);
              setRecordForm((f) => ({
                ...f,
                unitId: e.target.value,
                amount: f.amount || String(unit?.rentAmount ?? ""),
              }));
            }}
            required
          >
            <option value="">Choisir…</option>
            {allUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-12">
            <Select
              label="Type"
              value={recordForm.kind}
              onChange={(e) =>
                setRecordForm((f) => ({ ...f, kind: e.target.value }))
              }
            >
              {Object.entries(KINDS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Select
              label="Méthode"
              value={recordForm.method}
              onChange={(e) =>
                setRecordForm((f) => ({ ...f, method: e.target.value }))
              }
            >
              {Object.entries(METHODS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <Input
            label="Montant (FCFA)"
            type="number"
            min={1}
            value={recordForm.amount}
            onChange={(e) =>
              setRecordForm((f) => ({ ...f, amount: e.target.value }))
            }
            required
          />
          <div className="grid grid-cols-2 gap-12">
            <Input
              label="Du mois (facultatif)"
              type="month"
              value={recordForm.periodFrom}
              onChange={(e) =>
                setRecordForm((f) => ({ ...f, periodFrom: e.target.value }))
              }
            />
            <Input
              label="Au mois"
              type="month"
              value={recordForm.periodTo}
              onChange={(e) =>
                setRecordForm((f) => ({ ...f, periodTo: e.target.value }))
              }
              disabled={!recordForm.periodFrom}
            />
          </div>
          {formError && (
            <p className="text-[13px] text-rausch-600">{formError}</p>
          )}
          <Button type="submit" disabled={record.isPending}>
            {record.isPending ? "Enregistrement…" : "Enregistrer le paiement"}
          </Button>
        </form>
      </Modal>

      {/* ---- Modale : encaissement Mobile Money ---- */}
      <Modal
        open={momoOpen}
        onClose={() => setMomoOpen(false)}
        title="Encaisser par Mobile Money"
      >
        {momoUrl ? (
          <div className="flex flex-col gap-16">
            <p className="text-[14px] text-hof">
              Lien de paiement prêt. Envoyez-le au locataire (WhatsApp, SMS) :
              il tape son code PIN, le paiement se confirme tout seul ici.
            </p>
            <a
              href={momoUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all rounded-lg bg-faint p-12 text-[13px] text-hof underline"
            >
              {momoUrl}
            </a>
            <Button
              variant="ghost"
              onClick={() => navigator.clipboard.writeText(momoUrl)}
            >
              Copier le lien
            </Button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              momo.mutate();
            }}
            className="flex flex-col gap-16"
          >
            <Select
              label="Appartement"
              value={momoForm.unitId}
              onChange={(e) =>
                setMomoForm((f) => ({ ...f, unitId: e.target.value }))
              }
              required
            >
              <option value="">Choisir…</option>
              {allUnits.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </Select>
            <Select
              label="Réseau"
              value={momoForm.method}
              onChange={(e) =>
                setMomoForm((f) => ({ ...f, method: e.target.value }))
              }
            >
              <option value="MOMO">MTN MoMo</option>
              <option value="ORANGE_MONEY">Orange Money</option>
            </Select>
            <Input
              label="Téléphone du payeur"
              type="tel"
              placeholder="Ex. : 699 00 00 00"
              value={momoForm.payerPhone}
              onChange={(e) =>
                setMomoForm((f) => ({ ...f, payerPhone: e.target.value }))
              }
              required
            />
            <Input
              label="Montant (FCFA, vide = loyer de l'appartement)"
              type="number"
              min={1}
              value={momoForm.amount}
              onChange={(e) =>
                setMomoForm((f) => ({ ...f, amount: e.target.value }))
              }
            />
            {formError && (
              <p className="text-[13px] text-rausch-600">{formError}</p>
            )}
            {/* Rausch : c'est LE moment d'argent de l'écran. */}
            <Button variant="accent" type="submit" disabled={momo.isPending}>
              {momo.isPending ? "Création du lien…" : "Créer le lien de paiement"}
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}
