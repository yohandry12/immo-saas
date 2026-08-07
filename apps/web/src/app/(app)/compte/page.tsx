"use client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { goToLogin } from "@/lib/navigation";
import { clearSession } from "@/lib/session";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";

export default function ComptePage() {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const me = useQuery({ queryKey: ["me"], queryFn: authService.me });

  const remove = useMutation({
    mutationFn: authService.deleteMe,
    onSuccess: () => {
      clearSession();
      goToLogin();
    },
    onError: (e) => setDeleteError(errorMessage(e)),
  });

  const u = me.data?.user;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-24">
      <h1 className="text-heading font-bold text-hof">Mon compte</h1>

      <Card>
        <CardTitle>Identité</CardTitle>
        {me.isPending ? (
          <div className="flex flex-col gap-8" aria-busy="true">
            <Skeleton className="h-16 w-[60%]" />
            <Skeleton className="h-16 w-[45%]" />
          </div>
        ) : u ? (
          <dl className="flex flex-col gap-8 text-[14px]">
            <div className="flex justify-between gap-16">
              <dt className="text-foggy">Nom</dt>
              <dd className="font-medium text-hof">
                {u.firstName} {u.lastName}
              </dd>
            </div>
            {u.email && (
              <div className="flex justify-between gap-16">
                <dt className="text-foggy">Email</dt>
                <dd className="text-hof">{u.email}</dd>
              </div>
            )}
            {(me.data?.orgs ?? []).map((o) => (
              <div key={o.id} className="flex justify-between gap-16">
                <dt className="text-foggy">Portefeuille</dt>
                <dd className="text-hof">{o.name}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-[14px] text-foggy">
            Impossible de charger le profil.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Supprimer mon compte</CardTitle>
        <p className="text-[14px] text-foggy">
          Un propriétaire doit d&apos;abord céder ou fermer ses portefeuilles.
          Les téléphones de vos baux terminés seront effacés ; les écritures
          comptables conservent les noms.
        </p>
        <div className="mt-16">
          <Button
            variant="danger"
            onClick={() => {
              setDeleteError("");
              setDeleteOpen(true);
            }}
          >
            Supprimer mon compte
          </Button>
        </div>
      </Card>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Supprimer définitivement mon compte"
      >
        <p className="text-[14px] text-hof">
          Cette action est irréversible. Votre accès est supprimé
          immédiatement.
        </p>
        {deleteError && (
          <p className="mt-12 text-[13px] text-rausch-600">{deleteError}</p>
        )}
        <div className="mt-24 flex justify-end gap-12">
          <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
            Annuler
          </Button>
          <Button
            variant="danger"
            disabled={remove.isPending}
            onClick={() => remove.mutate()}
          >
            {remove.isPending ? "Suppression…" : "Supprimer mon compte"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
