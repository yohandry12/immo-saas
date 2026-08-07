"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { errorMessage } from "@/lib/api";
import { formatDate, formatFCFA } from "@/lib/format";
import { buildingsService } from "@/services/buildings.service";
import { leasesService } from "@/services/leases.service";
import type { Lease } from "@/services/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Select } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";
import { Table, Th, Td, Tr } from "@/components/ui/Table";

const emptyForm = {
  unitId: "",
  tenantName: "",
  tenantPhone: "",
  rentAmount: "",
  advanceMonths: "1",
  depositAmount: "",
};

export default function BauxPage() {
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [toTerminate, setToTerminate] = useState<Lease | null>(null);
  const [terminateError, setTerminateError] = useState("");

  const leases = useQuery<Lease[]>({
    queryKey: ["leases", activeFilter],
    queryFn: () => leasesService.list(activeFilter || undefined),
  });

  const buildings = useQuery({
    queryKey: ["buildings-units"],
    queryFn: async () => {
      const list = await buildingsService.list();
      return Promise.all(list.map((b) => buildingsService.getById(b.id)));
    },
    enabled: createOpen,
  });

  // Seuls les appartements SANS bail actif sont proposés à la signature.
  const vacantUnits = useMemo(
    () =>
      (buildings.data ?? []).flatMap((b) =>
        (b.units ?? [])
          .filter((u) => !u.leases?.length)
          .map((u) => ({
            id: u.id,
            label: `${b.name} · ${u.label}`,
            rentAmount: u.rentAmount,
          })),
      ),
    [buildings.data],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["leases"] });
    queryClient.invalidateQueries({ queryKey: ["buildings-units"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
  };

  const create = useMutation({
    mutationFn: () =>
      leasesService.create({
        unitId: form.unitId,
        tenantName: form.tenantName,
        tenantPhone: form.tenantPhone,
        ...(form.rentAmount && { rentAmount: Number(form.rentAmount) }),
        advanceMonths: Number(form.advanceMonths) || 1,
        ...(form.depositAmount && {
          depositAmount: Number(form.depositAmount),
        }),
      }),
    onSuccess: () => {
      invalidate();
      setCreateOpen(false);
      setForm(emptyForm);
      setFormError("");
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const terminate = useMutation({
    mutationFn: (id: string) => leasesService.terminate(id),
    onSuccess: () => {
      invalidate();
      setToTerminate(null);
      setTerminateError("");
    },
    onError: (e) => setTerminateError(errorMessage(e)),
  });

  const list = leases.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-24">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <h1 className="text-heading font-bold text-hof">Baux</h1>
        <Button
          onClick={() => {
            setFormError("");
            setCreateOpen(true);
          }}
        >
          Signer un bail
        </Button>
      </div>

      <Select
        aria-label="Filtrer les baux"
        value={activeFilter}
        onChange={(e) =>
          setActiveFilter(e.target.value as "" | "true" | "false")
        }
        className="w-auto self-start"
      >
        <option value="">Tous les baux</option>
        <option value="true">Actifs</option>
        <option value="false">Terminés</option>
      </Select>

      {leases.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Impossible de charger les baux : {errorMessage(leases.error)}
          </p>
          <Button variant="ghost" onClick={() => leases.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {leases.isPending && (
        <Card className="flex flex-col gap-12 p-24" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-[80%]" />
        </Card>
      )}

      {leases.isSuccess && list.length === 0 && (
        <Card>
          <EmptyState
            title="Aucun bail"
            hint="Signez un bail sur un appartement vacant : loyer contractuel, avance et caution y sont figés."
          />
        </Card>
      )}

      {list.length > 0 && (
        <Card className="p-4">
          <Table>
            <thead>
              <tr>
                <Th>Appartement</Th>
                <Th>Locataire</Th>
                <Th className="text-right">Loyer</Th>
                <Th>Début</Th>
                <Th>Statut</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {list.map((l) => (
                <Tr key={l.id}>
                  <Td className="font-medium">
                    {l.unit.building.name} · {l.unit.label}
                  </Td>
                  <Td>
                    {l.tenantName ?? "—"}
                    {l.tenantPhone && (
                      <span className="block text-[12px] text-foggy">
                        {l.tenantPhone}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right font-semibold tabular-nums">
                    {formatFCFA(l.rentAmount)}
                  </Td>
                  <Td className="whitespace-nowrap text-foggy">
                    {formatDate(l.startDate)}
                  </Td>
                  <Td>
                    {l.endDate ? (
                      <Badge>Terminé le {formatDate(l.endDate)}</Badge>
                    ) : (
                      <Badge tone="success">Actif</Badge>
                    )}
                  </Td>
                  <Td className="text-right">
                    {!l.endDate && (
                      <button
                        onClick={() => {
                          setTerminateError("");
                          setToTerminate(l);
                        }}
                        className="rounded-lg px-8 py-4 text-[13px] font-medium text-foggy hover:bg-faint hover:text-rausch-600"
                      >
                        Résilier
                      </button>
                    )}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {/* ---- Modale signature ---- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Signer un bail"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="flex flex-col gap-16"
        >
          <Select
            label="Appartement vacant"
            value={form.unitId}
            onChange={(e) => setForm((f) => ({ ...f, unitId: e.target.value }))}
            required
          >
            <option value="">
              {buildings.isPending ? "Chargement…" : "Choisir…"}
            </option>
            {vacantUnits.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label} ({formatFCFA(u.rentAmount)})
              </option>
            ))}
          </Select>
          {buildings.isSuccess && vacantUnits.length === 0 && (
            <p className="text-[13px] text-foggy">
              Aucun appartement vacant : tous portent déjà un bail actif.
            </p>
          )}
          <Input
            label="Nom du locataire"
            value={form.tenantName}
            onChange={(e) =>
              setForm((f) => ({ ...f, tenantName: e.target.value }))
            }
            required
          />
          <Input
            label="Téléphone du locataire"
            type="tel"
            placeholder="Ex. : 699 00 00 00"
            value={form.tenantPhone}
            onChange={(e) =>
              setForm((f) => ({ ...f, tenantPhone: e.target.value }))
            }
            required
          />
          <Input
            label="Loyer contractuel (FCFA, vide = loyer demandé)"
            type="number"
            min={1}
            value={form.rentAmount}
            onChange={(e) =>
              setForm((f) => ({ ...f, rentAmount: e.target.value }))
            }
          />
          <div className="grid grid-cols-2 gap-12">
            <Input
              label="Mois d'avance"
              type="number"
              min={1}
              value={form.advanceMonths}
              onChange={(e) =>
                setForm((f) => ({ ...f, advanceMonths: e.target.value }))
              }
              required
            />
            <Input
              label="Caution (FCFA)"
              type="number"
              min={0}
              value={form.depositAmount}
              onChange={(e) =>
                setForm((f) => ({ ...f, depositAmount: e.target.value }))
              }
            />
          </div>
          {formError && (
            <p className="text-[13px] text-rausch-600">{formError}</p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Signature…" : "Signer le bail"}
          </Button>
        </form>
      </Modal>

      {/* ---- Modale résiliation ---- */}
      <Modal
        open={toTerminate !== null}
        onClose={() => setToTerminate(null)}
        title={`Résilier le bail de ${toTerminate?.unit.label ?? ""}`}
      >
        <p className="text-[14px] text-hof">
          Le bail de {toTerminate?.tenantName ?? "ce locataire"} prend fin
          aujourd&apos;hui. L&apos;appartement redevient vacant ;
          l&apos;historique des paiements est conservé.
        </p>
        {terminateError && (
          <p className="mt-12 text-[13px] text-rausch-600">{terminateError}</p>
        )}
        <div className="mt-24 flex justify-end gap-12">
          <Button variant="ghost" onClick={() => setToTerminate(null)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={terminate.isPending}
            onClick={() => toTerminate && terminate.mutate(toTerminate.id)}
          >
            {terminate.isPending ? "Résiliation…" : "Résilier le bail"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
