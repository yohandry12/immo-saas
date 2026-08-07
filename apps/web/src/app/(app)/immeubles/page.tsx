"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { buildingsService } from "@/services/buildings.service";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";

// Liste du portefeuille : des rangées, pas une grille de cartes clonées.
export default function ImmeublesPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", address: "" });
  const [formError, setFormError] = useState("");

  const buildings = useQuery({
    queryKey: ["buildings"],
    queryFn: buildingsService.list,
  });

  const create = useMutation({
    mutationFn: () =>
      buildingsService.create({
        name: form.name,
        city: form.city,
        ...(form.address && { address: form.address }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buildings"] });
      setOpen(false);
      setForm({ name: "", city: "", address: "" });
      setFormError("");
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const list = buildings.data ?? [];
  const isEmpty = buildings.isSuccess && list.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-24">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <h1 className="text-heading font-bold text-hof">Immeubles</h1>
        {!isEmpty && (
          <Button onClick={() => setOpen(true)}>Créer un immeuble</Button>
        )}
      </div>

      {buildings.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Impossible de charger les immeubles :{" "}
            {errorMessage(buildings.error)}
          </p>
          <Button variant="ghost" onClick={() => buildings.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {buildings.isPending && (
        <Card className="flex flex-col gap-16 p-24" aria-busy="true">
          <Skeleton className="h-20 w-[60%]" />
          <Skeleton className="h-20 w-[45%]" />
          <Skeleton className="h-20 w-[52%]" />
        </Card>
      )}

      {isEmpty && (
        <Card>
          <EmptyState
            title="Votre premier immeuble commence ici"
            hint="Déclarez l'immeuble puis ses appartements : les baux, loyers et charges s'y rattacheront."
            action={
              // LE moment rausch du parcours : la toute première action.
              <Button variant="accent" onClick={() => setOpen(true)}>
                Créer mon premier immeuble
              </Button>
            }
          />
        </Card>
      )}

      {list.length > 0 && (
        <Card className="p-4">
          <ul>
            {list.map((b) => (
              <li key={b.id} className="border-b border-bebe last:border-b-0">
                <Link
                  href={`/immeubles/${b.id}`}
                  className="flex items-center justify-between gap-16 px-16 py-16 hover:bg-faint"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-ui font-medium text-hof">
                      {b.name}
                    </span>
                    <span className="mt-4 block text-[13px] text-foggy">
                      {b.city}
                      {b.address ? ` · ${b.address}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] tabular-nums text-foggy">
                    {b._count?.units ?? 0}{" "}
                    {(b._count?.units ?? 0) > 1 ? "appartements" : "appartement"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Créer un immeuble"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
          className="flex flex-col gap-16"
        >
          <Input
            label="Nom de l'immeuble"
            placeholder="Ex. : Résidence Makepe"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            label="Ville"
            placeholder="Ex. : Douala"
            value={form.city}
            onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            required
          />
          <Input
            label="Adresse (facultatif)"
            placeholder="Quartier, rue…"
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
          />
          {formError && (
            <p className="text-[13px] text-rausch-600">{formError}</p>
          )}
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? "Création…" : "Créer l'immeuble"}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
