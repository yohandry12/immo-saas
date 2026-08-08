"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { currentPeriod } from "@/lib/activity";
import { formatFCFA } from "@/lib/format";
import { buildingsService } from "@/services/buildings.service";
import { chargesService } from "@/services/charges.service";
import type { ChargeBill } from "@/services/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";
import { Table, Th, Td, Tr } from "@/components/ui/Table";

const TYPES: Record<string, string> = {
  WATER: "Eau",
  ELECTRICITY: "Électricité",
  OTHER: "Autre",
};
const RULES: Record<string, string> = {
  EQUAL: "Parts égales",
  BY_AREA: "Selon la surface",
  BY_OCCUPANTS: "Selon les occupants",
  CUSTOM: "Répartition manuelle",
};

const emptyForm = {
  buildingId: "",
  type: "WATER",
  amount: "",
  period: currentPeriod(),
  rule: "EQUAL",
};

export default function ChargesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [toSend, setToSend] = useState<ChargeBill | null>(null);
  const [sendError, setSendError] = useState("");

  const bills = useQuery<ChargeBill[]>({
    queryKey: ["charges"],
    queryFn: () => chargesService.list(),
  });
  const buildings = useQuery({
    queryKey: ["buildings"],
    queryFn: buildingsService.list,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["charges"] });
    queryClient.invalidateQueries({ queryKey: ["payments"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
  };

  const create = useMutation({
    mutationFn: () =>
      chargesService.create({
        buildingId: form.buildingId,
        type: form.type,
        amount: Number(form.amount),
        period: form.period,
        rule: form.rule as "EQUAL" | "BY_AREA" | "BY_OCCUPANTS",
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setForm(emptyForm);
      setFormError("");
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const send = useMutation({
    mutationFn: (id: string) => chargesService.send(id),
    onSuccess: () => {
      invalidate();
      setToSend(null);
      setSendError("");
    },
    onError: (e) => setSendError(errorMessage(e)),
  });

  const markPaid = useMutation({
    mutationFn: ({
      billId,
      allocationId,
    }: {
      billId: string;
      allocationId: string;
    }) => chargesService.markPaid(billId, allocationId),
    onSuccess: invalidate,
  });

  const list = bills.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-24">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <h1 className="text-heading font-bold text-hof">Charges communes</h1>
        <Button
          onClick={() => {
            setFormError("");
            setCreateOpen(true);
          }}
        >
          Créer une facture
        </Button>
      </div>

      {bills.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Impossible de charger les charges : {errorMessage(bills.error)}
          </p>
          <Button variant="ghost" onClick={() => bills.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {bills.isPending && (
        <Card className="flex flex-col gap-12 p-24" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-[70%]" />
        </Card>
      )}

      {bills.isSuccess && list.length === 0 && (
        <Card>
          <EmptyState
            title="Aucune facture de charges"
            hint="Créez la facture d'eau ou d'électricité de l'immeuble : elle sera répartie entre les appartements, puis envoyée aux locataires."
          />
        </Card>
      )}

      {list.map((bill) => {
        const paid = bill.allocations.filter((a) => a.paid).length;
        return (
          <Card key={bill.id} className="flex flex-col gap-12">
            <div className="flex flex-wrap items-start justify-between gap-12">
              <div>
                <p className="text-ui font-semibold text-hof">
                  {TYPES[bill.type] ?? bill.type} · {bill.building.name}
                </p>
                <p className="text-label text-foggy">
                  {bill.period} · {RULES[bill.rule]} ·{" "}
                  <span className="tabular-nums">
                    {formatFCFA(bill.amount)}
                  </span>
                </p>
              </div>
              <div className="flex items-center gap-12">
                {bill.status === "DRAFT" ? (
                  <>
                    <Badge tone="warning">Brouillon</Badge>
                    <Button
                      className="h-32 px-12"
                      onClick={() => {
                        setSendError("");
                        setToSend(bill);
                      }}
                    >
                      Envoyer aux locataires
                    </Button>
                  </>
                ) : (
                  <Badge tone={paid === bill.allocations.length ? "success" : "neutral"}>
                    Envoyée · {paid}/{bill.allocations.length} payées
                  </Badge>
                )}
              </div>
            </div>

            <Table>
              <thead>
                <tr>
                  <Th>Appartement</Th>
                  <Th className="text-right">Part</Th>
                  <Th className="text-right">Règlement</Th>
                </tr>
              </thead>
              <tbody>
                {bill.allocations.map((a) => (
                  <Tr key={a.id}>
                    <Td className="font-medium">{a.unit.label}</Td>
                    <Td className="text-right tabular-nums">
                      {formatFCFA(a.amount)}
                    </Td>
                    <Td className="text-right">
                      {a.paid ? (
                        <Badge tone="success">Payée</Badge>
                      ) : bill.status === "SENT" ? (
                        <button
                          onClick={() =>
                            markPaid.mutate({
                              billId: bill.id,
                              allocationId: a.id,
                            })
                          }
                          disabled={markPaid.isPending}
                          className="rounded-lg px-8 py-4 text-label font-medium text-hof underline hover:bg-faint"
                        >
                          Marquer payée
                        </button>
                      ) : (
                        <span className="text-label text-foggy">—</span>
                      )}
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Card>
        );
      })}

      {/* ---- Modale création ---- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Créer une facture de charges"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="flex flex-col gap-16"
        >
          <Select
            label="Immeuble"
            value={form.buildingId}
            onChange={(e) =>
              setForm((f) => ({ ...f, buildingId: e.target.value }))
            }
            required
          >
            <option value="">Choisir…</option>
            {(buildings.data ?? []).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-12">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              {Object.entries(TYPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Input
              label="Période"
              type="month"
              value={form.period}
              onChange={(e) =>
                setForm((f) => ({ ...f, period: e.target.value }))
              }
              required
            />
          </div>
          <Input
            label="Montant total (FCFA)"
            type="number"
            min={1}
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            required
          />
          <Select
            label="Règle de répartition"
            value={form.rule}
            onChange={(e) => setForm((f) => ({ ...f, rule: e.target.value }))}
          >
            <option value="EQUAL">Parts égales entre appartements</option>
            <option value="BY_AREA">Proportionnelle à la surface</option>
            <option value="BY_OCCUPANTS">Proportionnelle aux occupants</option>
          </Select>
          <p className="text-label text-foggy">
            La facture reste en brouillon : vérifiez la répartition, puis
            envoyez-la. Une fois envoyée, les parts sont figées.
          </p>
          {formError && (
            <p className="text-label text-rausch-600">{formError}</p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Création…" : "Créer le brouillon"}
          </Button>
        </form>
      </Modal>

      {/* ---- Modale envoi (irréversible) ---- */}
      <Modal
        open={toSend !== null}
        onClose={() => setToSend(null)}
        title="Envoyer la facture aux locataires"
      >
        <p className="text-body text-hof">
          La répartition ci-dessous sera figée définitivement : ce qui est
          réclamé à chaque locataire ne changera plus, même si la facture est
          modifiée ensuite.
        </p>
        <ul className="mt-12 rounded-lg bg-faint p-12">
          {toSend?.allocations.map((a) => (
            <li
              key={a.id}
              className="flex justify-between py-4 text-body text-hof"
            >
              <span>{a.unit.label}</span>
              <span className="font-medium tabular-nums">
                {formatFCFA(a.amount)}
              </span>
            </li>
          ))}
        </ul>
        {sendError && (
          <p className="mt-12 text-label text-rausch-600">{sendError}</p>
        )}
        <div className="mt-24 flex justify-end gap-12">
          <Button variant="ghost" onClick={() => setToSend(null)}>
            Annuler
          </Button>
          <Button
            disabled={send.isPending}
            onClick={() => toSend && send.mutate(toSend.id)}
          >
            {send.isPending ? "Envoi…" : "Envoyer et figer la répartition"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
