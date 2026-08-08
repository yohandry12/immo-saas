"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { currentPeriod, eventLabel, relativeTime } from "@/lib/activity";
import { errorMessage } from "@/lib/api";
import { formatFCFA } from "@/lib/format";
import { useActivityFeed } from "@/lib/useActivityFeed";
import { dashboardService } from "@/services/dashboard.service";
import type { FeedEvent } from "@/services/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";
import { Table, Th, Td, Tr } from "@/components/ui/Table";

// La question de l'écran : « le mois est-il bon ? » — répondue par la
// carte du mois avant tout détail (PRODUCT.md, principe 1).
export default function DashboardPage() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState(currentPeriod);

  const summary = useQuery({
    queryKey: ["summary", period],
    queryFn: () => dashboardService.summary(period),
  });
  const history = useQuery({
    queryKey: ["activity"],
    queryFn: dashboardService.activity,
  });

  // Flux SSE : chaque événement rafraîchit les chiffres du mois,
  // « voir ses loyers tomber en direct ». Le layout (app) garantit
  // déjà la session : pas de lecture de localStorage pendant le rendu.
  const { events: live, connected } = useActivityFeed(true);
  useEffect(() => {
    if (live.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    }
  }, [live.length, queryClient]);

  // Le flux se reconnecte tout seul après une coupure ; le temps qu'il
  // reprenne, l'historique reste affiché. On invalide au retour du
  // direct : les événements survenus pendant la coupure sont rattrapés.
  useEffect(() => {
    if (connected) {
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
    }
  }, [connected, queryClient]);

  // Historique + direct fusionnés, dédupliqués (type+date), 30 max.
  const feed = useMemo(() => {
    const seen = new Set<string>();
    const merged: FeedEvent[] = [];
    for (const e of [...live, ...(history.data ?? [])]) {
      const key = `${e.type}|${e.createdAt}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(e);
    }
    return merged.slice(0, 30);
  }, [live, history.data]);

  const s = summary.data;
  const rate = s && s.expectedRent > 0 ? s.collectedRent / s.expectedRent : 0;

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-24">
      <div className="flex flex-wrap items-center justify-between gap-12">
        <h1 className="text-heading font-bold text-hof">Tableau de bord</h1>
        <label className="flex items-center gap-8 text-label font-medium text-foggy">
          Mois
          <input
            type="month"
            value={period}
            max={currentPeriod()}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
            className="h-40 rounded-lg border border-bebe bg-white px-12 text-body text-hof focus:border-hof focus:outline-none"
          />
        </label>
      </div>

      {summary.isError && (
        <Card className="flex items-center justify-between gap-16">
          <p className="text-hof">
            Impossible de charger le mois : {errorMessage(summary.error)}
          </p>
          <Button variant="ghost" onClick={() => summary.refetch()}>
            Réessayer
          </Button>
        </Card>
      )}

      {summary.isPending && (
        <Card aria-busy="true" aria-label="Chargement du mois">
          <Skeleton className="mb-12 h-16 w-[120px]" />
          <Skeleton className="mb-16 h-32 w-[280px]" />
          <Skeleton className="mb-16 h-8 w-full" />
          <Skeleton className="h-14 w-[360px] max-w-full" />
        </Card>
      )}

      {s && s.occupancy.total === 0 && (
        <Card>
          <EmptyState
            title="Votre portefeuille est vide pour l'instant"
            hint="Créez votre premier immeuble et ses appartements : les loyers, baux et charges apparaîtront ici."
            action={
              <Link
                href="/immeubles"
                className="inline-flex h-40 items-center justify-center rounded-lg bg-rausch px-16 text-body font-medium text-white hover:bg-rausch-600"
              >
                Créer mon premier immeuble
              </Link>
            }
          />
        </Card>
      )}

      {s && s.occupancy.total > 0 && (
        <>
          {/* ---- Le mois : l'élément héroïque ---- */}
          <Card className="p-24">
            <p className="text-label font-medium text-foggy">
              Loyers encaissés
            </p>
            <p className="mt-4 text-heading font-bold text-hof">
              <span className="whitespace-nowrap tabular-nums">
                {formatFCFA(s.collectedRent)}
              </span>
              {/* Bloc sur mobile : le comparatif ne coupe jamais un montant. */}
              <span className="block text-ui font-normal text-foggy sm:ml-8 sm:inline">
                sur{" "}
                <span className="whitespace-nowrap tabular-nums">
                  {formatFCFA(s.expectedRent)}
                </span>{" "}
                attendus
              </span>
            </p>
            <div
              role="progressbar"
              aria-valuenow={Math.round(rate * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Part du loyer attendu déjà encaissée"
              className="mt-16 h-8 w-full overflow-hidden rounded-full bg-faint"
            >
              <div
                className="h-full rounded-full bg-hof transition-[width] duration-300 ease-out motion-reduce:transition-none"
                style={{ width: `${Math.min(rate, 1) * 100}%` }}
              />
            </div>
            <p className="mt-16 text-body text-foggy">
              {s.outstandingRent > 0 ? (
                <>
                  Reste dû :{" "}
                  <span className="font-semibold tabular-nums text-hof">
                    {formatFCFA(s.outstandingRent)}
                  </span>
                </>
              ) : (
                <span className="font-medium text-hof">
                  Tous les loyers du mois sont couverts.
                </span>
              )}
              <span className="mx-8" aria-hidden="true">
                ·
              </span>
              Cautions détenues :{" "}
              <span className="tabular-nums">{formatFCFA(s.depositsHeld)}</span>
              <span className="mx-8" aria-hidden="true">
                ·
              </span>
              {s.occupancy.occupied}/{s.occupancy.total} appartements occupés
            </p>
          </Card>

          {/* ---- Impayés (l'actionnable) + activité (la preuve) ---- */}
          <div className="grid gap-24 lg:grid-cols-[2fr_1fr]">
            <section aria-labelledby="titre-impayes">
              <h2
                id="titre-impayes"
                className="mb-12 text-heading-sm font-medium text-hof"
              >
                Loyers en attente
              </h2>
              <Card className="p-4">
                {s.unpaidUnits.length === 0 ? (
                  <EmptyState
                    title="Aucun impayé ce mois-ci"
                    hint="Chaque appartement occupé a couvert son loyer."
                  />
                ) : (
                  <Table>
                    <thead>
                      <tr>
                        <Th>Appartement</Th>
                        <Th>Locataire</Th>
                        <Th className="text-right">Montant dû</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.unpaidUnits.map((u) => (
                        <Tr key={u.label}>
                          <Td className="font-medium">{u.label}</Td>
                          <Td className="text-foggy">
                            {u.tenantName ?? "Sans locataire nommé"}
                          </Td>
                          <Td className="text-right font-semibold tabular-nums">
                            {formatFCFA(u.due)}
                          </Td>
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            </section>

            <section aria-labelledby="titre-activite">
              <h2
                id="titre-activite"
                className="mb-12 flex items-center gap-8 text-heading-sm font-medium text-hof"
              >
                Activité
                <span className="flex items-center gap-4 text-caption font-semibold text-foggy">
                  <span
                    aria-hidden="true"
                    className="h-8 w-8 rounded-full bg-[#1e7e34] animate-live-pulse"
                  />
                  En direct
                </span>
              </h2>
              <Card className="p-4">
                {history.isPending ? (
                  <div className="flex flex-col gap-12 p-12">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-[80%]" />
                    <Skeleton className="h-14 w-[90%]" />
                  </div>
                ) : feed.length === 0 ? (
                  <EmptyState
                    title="Rien à signaler"
                    hint="Les paiements, baux et dépenses apparaîtront ici dès qu'ils arrivent."
                  />
                ) : (
                  <ul aria-live="polite" className="flex flex-col">
                    {feed.map((e, i) => (
                      <li
                        key={`${e.type}|${e.createdAt}`}
                        className={`border-b border-bebe px-12 py-12 last:border-b-0 ${
                          i === 0 && live.length > 0 ? "animate-feed-in" : ""
                        }`}
                      >
                        <p className="text-body text-hof">{eventLabel(e)}</p>
                        <p className="mt-4 text-caption text-foggy">
                          {relativeTime(e.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
