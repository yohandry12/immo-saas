"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { buildingsService } from "@/services/buildings.service";
import type { Unit } from "@/services/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";

const emptyUnitForm = {
  label: "",
  rentAmount: "",
  floor: "",
  occupied: false,
  tenantName: "",
  tenantPhone: "",
  advanceMonths: "1",
  depositAmount: "",
};

export default function ImmeubleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [unitForm, setUnitForm] = useState(emptyUnitForm);
  const [formError, setFormError] = useState("");
  // Cible d'une suppression en attente de confirmation (unit ou immeuble).
  const [toDelete, setToDelete] = useState<Unit | "building" | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const building = useQuery({
    queryKey: ["building", id],
    queryFn: () => buildingsService.getById(id),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["building", id] });
    queryClient.invalidateQueries({ queryKey: ["buildings"] });
    queryClient.invalidateQueries({ queryKey: ["summary"] });
  };

  const addUnit = useMutation({
    mutationFn: () =>
      buildingsService.createUnit(id, {
        label: unitForm.label,
        rentAmount: Number(unitForm.rentAmount),
        ...(unitForm.floor !== "" && { floor: Number(unitForm.floor) }),
        ...(unitForm.occupied && {
          lease: {
            tenantName: unitForm.tenantName,
            tenantPhone: unitForm.tenantPhone,
            advanceMonths: Number(unitForm.advanceMonths) || 1,
            ...(unitForm.depositAmount !== "" && {
              depositAmount: Number(unitForm.depositAmount),
            }),
          },
        }),
      }),
    onSuccess: () => {
      refresh();
      setAddOpen(false);
      setUnitForm(emptyUnitForm);
      setFormError("");
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const removeUnit = useMutation({
    mutationFn: (unitId: string) => buildingsService.removeUnit(id, unitId),
    onSuccess: () => {
      refresh();
      setToDelete(null);
      setDeleteError("");
    },
    onError: (e) => setDeleteError(errorMessage(e)),
  });

  const removeBuilding = useMutation({
    mutationFn: () => buildingsService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildings"] });
      window.location.assign(
        new URL("/immeubles", window.location.origin).toString(),
      );
    },
    onError: (e) => setDeleteError(errorMessage(e)),
  });

  const b = building.data;
  const units = b?.units ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-24">
      <div>
        <Link
          href="/immeubles"
          className="text-[13px] font-medium text-foggy hover:text-hof"
        >
          ← Tous les immeubles
        </Link>
        {building.isPending ? (
          <Skeleton className="mt-8 h-32 w-[280px]" />
        ) : b ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-12">
            <div>
              <h1 className="text-heading font-bold text-hof">{b.name}</h1>
              <p className="text-[14px] text-foggy">
                {b.city}
                {b.address ? ` · ${b.address}` : ""}
              </p>
            </div>
            <Button onClick={() => setAddOpen(true)}>
              Ajouter un appartement
            </Button>
          </div>
        ) : null}
      </div>

      {building.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Immeuble introuvable : {errorMessage(building.error)}
          </p>
          <Button variant="ghost" onClick={() => building.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {building.isPending && (
        <div className="grid gap-16 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
      )}

      {b && units.length === 0 && (
        <Card>
          <EmptyState
            title="Aucun appartement pour l'instant"
            hint="Ajoutez chaque appartement avec son loyer. S'il est déjà occupé, déclarez le bail dans le même geste."
            action={
              <Button onClick={() => setAddOpen(true)}>
                Ajouter un appartement
              </Button>
            }
          />
        </Card>
      )}

      {units.length > 0 && (
        <ul className="grid gap-16 [grid-template-columns:repeat(auto-fill,minmax(240px,1fr))]">
          {units.map((u) => {
            const lease = u.leases?.[0];
            return (
              <li key={u.id}>
                <Card className="flex h-full flex-col gap-8">
                  <div className="flex items-start justify-between gap-8">
                    <span className="text-ui font-semibold text-hof">
                      {u.label}
                    </span>
                    {lease ? (
                      <Badge tone="success">Occupé</Badge>
                    ) : (
                      <Badge>Vacant</Badge>
                    )}
                  </div>
                  <p className="text-[14px] tabular-nums text-hof">
                    {formatFCFA(lease?.rentAmount ?? u.rentAmount)}
                    <span className="text-foggy"> / mois</span>
                  </p>
                  <p className="min-h-[20px] text-[13px] text-foggy">
                    {lease
                      ? (lease.tenantName ?? "Locataire sans nom")
                      : u.floor != null
                        ? `Étage ${u.floor}`
                        : "Libre à la location"}
                  </p>
                  <div className="mt-auto flex justify-end">
                    <button
                      onClick={() => {
                        setDeleteError("");
                        setToDelete(u);
                      }}
                      className="rounded-lg px-8 py-4 text-[13px] font-medium text-foggy hover:bg-faint hover:text-rausch-600"
                    >
                      Supprimer
                    </button>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {b && (
        <div className="flex justify-end border-t border-bebe pt-16">
          <Button
            variant="danger"
            onClick={() => {
              setDeleteError("");
              setToDelete("building");
            }}
          >
            Supprimer l&apos;immeuble
          </Button>
        </div>
      )}

      {/* ---- Modale ajout appartement ---- */}
      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Ajouter un appartement"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addUnit.mutate();
          }}
          className="flex flex-col gap-16"
        >
          <div className="grid grid-cols-2 gap-12">
            <Input
              label="Nom / numéro"
              placeholder="Ex. : A1"
              value={unitForm.label}
              onChange={(e) =>
                setUnitForm((f) => ({ ...f, label: e.target.value }))
              }
              required
            />
            <Input
              label="Étage (facultatif)"
              type="number"
              value={unitForm.floor}
              onChange={(e) =>
                setUnitForm((f) => ({ ...f, floor: e.target.value }))
              }
            />
          </div>
          <Input
            label="Loyer mensuel (FCFA)"
            type="number"
            min={1}
            placeholder="Ex. : 150000"
            value={unitForm.rentAmount}
            onChange={(e) =>
              setUnitForm((f) => ({ ...f, rentAmount: e.target.value }))
            }
            required
          />

          <label className="flex items-center gap-8 text-[14px] text-hof">
            <input
              type="checkbox"
              checked={unitForm.occupied}
              onChange={(e) =>
                setUnitForm((f) => ({ ...f, occupied: e.target.checked }))
              }
              className="h-16 w-16 accent-hof"
            />
            Déjà occupé : déclarer le bail en place
          </label>

          {unitForm.occupied && (
            <div className="flex flex-col gap-16 rounded-lg bg-faint p-16">
              <Input
                label="Nom du locataire"
                value={unitForm.tenantName}
                onChange={(e) =>
                  setUnitForm((f) => ({ ...f, tenantName: e.target.value }))
                }
                required
              />
              <Input
                label="Téléphone du locataire"
                type="tel"
                placeholder="Ex. : 699 00 00 00"
                value={unitForm.tenantPhone}
                onChange={(e) =>
                  setUnitForm((f) => ({ ...f, tenantPhone: e.target.value }))
                }
                required
              />
              <div className="grid grid-cols-2 gap-12">
                <Input
                  label="Mois d'avance"
                  type="number"
                  min={1}
                  value={unitForm.advanceMonths}
                  onChange={(e) =>
                    setUnitForm((f) => ({
                      ...f,
                      advanceMonths: e.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label="Caution (FCFA)"
                  type="number"
                  min={0}
                  value={unitForm.depositAmount}
                  onChange={(e) =>
                    setUnitForm((f) => ({
                      ...f,
                      depositAmount: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          )}

          {formError && (
            <p className="text-[13px] text-rausch-600">{formError}</p>
          )}
          <Button type="submit" disabled={addUnit.isPending}>
            {addUnit.isPending ? "Ajout…" : "Ajouter l'appartement"}
          </Button>
        </form>
      </Modal>

      {/* ---- Modale confirmation de suppression ---- */}
      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title={
          toDelete === "building"
            ? `Supprimer ${b?.name ?? "l'immeuble"}`
            : `Supprimer ${toDelete?.label ?? ""}`
        }
      >
        <p className="text-[14px] text-hof">
          {toDelete === "building"
            ? "L'immeuble, ses appartements et leurs baux seront supprimés. Les appartements avec un historique de paiements ne peuvent pas être supprimés : la comptabilité est conservée."
            : "L'appartement et ses baux seront supprimés. S'il porte un historique de paiements, la suppression sera refusée : la comptabilité est conservée."}
        </p>
        {deleteError && (
          <p className="mt-12 text-[13px] text-rausch-600">{deleteError}</p>
        )}
        <div className="mt-24 flex justify-end gap-12">
          <Button variant="ghost" onClick={() => setToDelete(null)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={removeUnit.isPending || removeBuilding.isPending}
            onClick={() =>
              toDelete === "building"
                ? removeBuilding.mutate()
                : toDelete && removeUnit.mutate(toDelete.id)
            }
          >
            {removeUnit.isPending || removeBuilding.isPending
              ? "Suppression…"
              : toDelete === "building"
                ? "Supprimer l'immeuble"
                : `Supprimer ${toDelete?.label ?? ""}`}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
