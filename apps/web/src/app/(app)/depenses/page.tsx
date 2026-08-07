"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { formatDate, formatFCFA } from "@/lib/format";
import { buildingsService } from "@/services/buildings.service";
import { expensesService } from "@/services/expenses.service";
import type { Expense } from "@/services/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";
import { Table, Th, Td, Tr } from "@/components/ui/Table";

const CATEGORIES: Record<string, string> = {
  PLUMBING: "Plomberie",
  ELECTRIC: "Électricité",
  PAINT: "Peinture",
  SECURITY: "Gardiennage",
  CLEANING: "Nettoyage",
  OTHER: "Autre",
};

const emptyForm = {
  buildingId: "",
  category: "PLUMBING",
  amount: "",
  description: "",
};

export default function DepensesPage() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [buildingFilter, setBuildingFilter] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");

  const expenses = useQuery<Expense[]>({
    queryKey: ["expenses", buildingFilter],
    queryFn: () => expensesService.list(buildingFilter || undefined),
  });
  const buildings = useQuery({
    queryKey: ["buildings"],
    queryFn: buildingsService.list,
  });

  const buildingName = (id: string) =>
    buildings.data?.find((b) => b.id === id)?.name ?? "";

  const create = useMutation({
    mutationFn: () =>
      expensesService.create({
        buildingId: form.buildingId,
        category: form.category,
        amount: Number(form.amount),
        description: form.description,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      setCreateOpen(false);
      setForm(emptyForm);
      setFormError("");
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const list = expenses.data ?? [];
  const total = list.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-24">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <h1 className="text-heading font-bold text-hof">Dépenses</h1>
        <Button
          onClick={() => {
            setFormError("");
            setCreateOpen(true);
          }}
        >
          Déclarer une dépense
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-12">
        <Select
          aria-label="Filtrer par immeuble"
          value={buildingFilter}
          onChange={(e) => setBuildingFilter(e.target.value)}
          className="w-auto min-w-[200px]"
        >
          <option value="">Tous les immeubles</option>
          {(buildings.data ?? []).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        {list.length > 0 && (
          <p className="text-[14px] text-foggy">
            Total :{" "}
            <span className="font-semibold tabular-nums text-hof">
              {formatFCFA(total)}
            </span>
          </p>
        )}
      </div>

      {expenses.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Impossible de charger les dépenses : {errorMessage(expenses.error)}
          </p>
          <Button variant="ghost" onClick={() => expenses.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {expenses.isPending && (
        <Card className="flex flex-col gap-12 p-24" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-[75%]" />
        </Card>
      )}

      {expenses.isSuccess && list.length === 0 && (
        <Card>
          <EmptyState
            title="Aucune dépense déclarée"
            hint="Chaque réparation ou entretien déclaré ici apparaît dans le feed du propriétaire : la transparence, c'est le produit."
          />
        </Card>
      )}

      {list.length > 0 && (
        <Card className="p-4">
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Immeuble</Th>
                <Th>Catégorie</Th>
                <Th>Description</Th>
                <Th className="text-right">Montant</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <Tr key={e.id}>
                  <Td className="whitespace-nowrap text-foggy">
                    {formatDate(e.createdAt)}
                  </Td>
                  <Td className="font-medium">
                    {e.building?.name ?? buildingName(e.buildingId)}
                  </Td>
                  <Td>{CATEGORIES[e.category] ?? e.category}</Td>
                  <Td className="max-w-[320px] truncate text-foggy">
                    {e.description}
                  </Td>
                  <Td className="text-right font-semibold tabular-nums">
                    {formatFCFA(e.amount)}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Déclarer une dépense"
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
              label="Catégorie"
              value={form.category}
              onChange={(e) =>
                setForm((f) => ({ ...f, category: e.target.value }))
              }
            >
              {Object.entries(CATEGORIES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Input
              label="Montant (FCFA)"
              type="number"
              min={1}
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              required
            />
          </div>
          <Input
            label="Description"
            placeholder="Ex. : réparation fuite salle de bain A2"
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            required
          />
          <p className="text-[13px] text-foggy">
            Les photos des travaux arrivent bientôt : en attendant, décrivez
            précisément la dépense.
          </p>
          {formError && (
            <p className="text-[13px] text-rausch-600">{formError}</p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Déclaration…" : "Déclarer la dépense"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
