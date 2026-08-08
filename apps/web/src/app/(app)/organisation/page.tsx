"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { orgService } from "@/services/org.service";
import type { Member } from "@/services/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";

const ROLES: Record<string, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Gestionnaire",
  TENANT: "Locataire",
};

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
};

export default function OrganisationPage() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [toRevoke, setToRevoke] = useState<Member | null>(null);
  const [revokeError, setRevokeError] = useState("");

  const members = useQuery<Member[]>({
    queryKey: ["members"],
    queryFn: orgService.listMembers,
  });

  const invite = useMutation({
    mutationFn: () =>
      orgService.inviteManager({
        firstName: form.firstName,
        lastName: form.lastName,
        password: form.password,
        ...(form.email && { email: form.email }),
        ...(form.phone && { phone: form.phone }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setInviteOpen(false);
      setForm(emptyForm);
      setFormError("");
    },
    onError: (e) => setFormError(errorMessage(e)),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => orgService.revokeManager(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      setToRevoke(null);
      setRevokeError("");
    },
    onError: (e) => setRevokeError(errorMessage(e)),
  });

  const list = members.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-24">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <h1 className="text-heading font-bold text-hof">Organisation</h1>
        <Button
          onClick={() => {
            setFormError("");
            setInviteOpen(true);
          }}
        >
          Ajouter un gestionnaire
        </Button>
      </div>

      {members.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Impossible de charger l&apos;équipe : {errorMessage(members.error)}
          </p>
          <Button variant="ghost" onClick={() => members.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {members.isPending && (
        <Card className="flex flex-col gap-12 p-24" aria-busy="true">
          <Skeleton className="h-20 w-[70%]" />
          <Skeleton className="h-20 w-[55%]" />
        </Card>
      )}

      {members.isSuccess && list.length === 0 && (
        <Card>
          <EmptyState title="Aucun membre" hint="Étrange : le propriétaire devrait apparaître ici." />
        </Card>
      )}

      {list.length > 0 && (
        <Card className="p-4">
          <ul>
            {list.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-16 border-b border-bebe px-16 py-16 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-ui font-medium text-hof">
                    {m.user.firstName} {m.user.lastName}
                  </p>
                  <p className="truncate text-label text-foggy">
                    {m.user.email ?? m.user.phone ?? ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-12">
                  <Badge tone={m.role === "OWNER" ? "success" : "neutral"}>
                    {ROLES[m.role] ?? m.role}
                  </Badge>
                  {m.role !== "OWNER" && (
                    <button
                      onClick={() => {
                        setRevokeError("");
                        setToRevoke(m);
                      }}
                      className="rounded-lg px-8 py-4 text-label font-medium text-foggy hover:bg-faint hover:text-rausch-600"
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Ajouter un gestionnaire"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            invite.mutate();
          }}
          className="flex flex-col gap-16"
        >
          <p className="text-body text-foggy">
            Le gestionnaire sur place pourra enregistrer les paiements,
            déclarer les dépenses et gérer les baux de ce portefeuille.
          </p>
          <div className="grid grid-cols-2 gap-12">
            <Input
              label="Prénom"
              value={form.firstName}
              onChange={(e) =>
                setForm((f) => ({ ...f, firstName: e.target.value }))
              }
              required
            />
            <Input
              label="Nom"
              value={form.lastName}
              onChange={(e) =>
                setForm((f) => ({ ...f, lastName: e.target.value }))
              }
              required
            />
          </div>
          <Input
            label="Email (ou laissez vide si téléphone)"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            label="Téléphone"
            type="tel"
            placeholder="Ex. : 699 00 00 00"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            label="Mot de passe provisoire"
            type="text"
            minLength={8}
            placeholder="8 caractères minimum, à lui transmettre"
            value={form.password}
            onChange={(e) =>
              setForm((f) => ({ ...f, password: e.target.value }))
            }
            required
          />
          {formError && (
            <p className="text-label text-rausch-600">{formError}</p>
          )}
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? "Création…" : "Créer le compte gestionnaire"}
          </Button>
        </form>
      </Modal>

      <Modal
        open={toRevoke !== null}
        onClose={() => setToRevoke(null)}
        title={`Retirer ${toRevoke?.user.firstName ?? ""} ${toRevoke?.user.lastName ?? ""}`}
      >
        <p className="text-body text-hof">
          Cette personne perdra l&apos;accès au portefeuille. Les paiements
          qu&apos;elle a enregistrés gardent son nom : la comptabilité ne
          change pas.
        </p>
        {revokeError && (
          <p className="mt-12 text-label text-rausch-600">{revokeError}</p>
        )}
        <div className="mt-24 flex justify-end gap-12">
          <Button variant="ghost" onClick={() => setToRevoke(null)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={revoke.isPending}
            onClick={() => toRevoke && revoke.mutate(toRevoke.user.id)}
          >
            {revoke.isPending ? "Retrait…" : "Retirer l'accès"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
