"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { currentPeriod, eventLabel, relativeTime } from "@/lib/activity";
import { errorMessage } from "@/lib/api";
import { formatFCFA, monthLabel } from "@/lib/format";
import { useActivityFeed } from "@/lib/useActivityFeed";
import { dashboardService } from "@/services/dashboard.service";
import type { FeedEvent } from "@/services/types";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, EmptyState } from "@/components/ui/Skeleton";
import { Sparkline } from "@/components/ui/Sparkline";

// Ancienneté du retard : nommer l'urgence. Un retard de 2 jours et de
// 2 mois ne se traitent pas pareil — le tableau plat les montrait
// identiques. Couleur sémantique discrète, jamais criarde.
function LateBadge({ days }: { days: number }) {
  if (days <= 0) return null;
  const tone =
    days >= 30 ? "text-danger" : days >= 7 ? "text-warning" : "text-foggy";
  const text =
    days >= 60
      ? `${Math.floor(days / 30)} mois de retard`
      : days >= 30
        ? "1 mois de retard"
        : `${days} jour${days > 1 ? "s" : ""} de retard`;
  return <span className={`font-medium ${tone}`}>· {text}</span>;
}

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
  // Aucun loyer attendu (bail sans montant, franchise) n'est PAS « 0 % » :
  // ce serait un faux « personne n'a payé » sur un écran d'argent.
  const noRentExpected = !!s && s.expectedRent === 0;
  const rate = s && s.expectedRent > 0 ? s.collectedRent / s.expectedRent : 0;
  const pct = Math.round(rate * 100);

  // Verdict : la réponse à « le mois est-il bon ? ». On compare l'encaissé
  // d'aujourd'hui à celui du même jour du mois dernier — un montant, pas
  // un taux, pour rester juste même si le loyer attendu a changé.
  const verdict = (() => {
    if (!s) return null;
    const prev = s.previousAtSameDay.collectedRent;
    if (s.outstandingRent === 0) {
      return { tone: "success" as const, text: "Tous les loyers du mois sont couverts." };
    }
    if (prev === 0) {
      return { tone: "neutral" as const, text: `${s.unpaidUnits.length} loyer${s.unpaidUnits.length > 1 ? "s" : ""} encore en attente ce mois-ci.` };
    }
    const delta = s.collectedRent - prev;
    if (delta > 0) {
      return { tone: "success" as const, text: "En avance sur le mois dernier à la même date." };
    }
    if (delta < 0) {
      return { tone: "warning" as const, text: "En retard sur le mois dernier à la même date." };
    }
    return { tone: "neutral" as const, text: "Au même niveau que le mois dernier à la même date." };
  })();

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-40">
      {/* Le titre de page passe en libellé discret : « Tableau de bord »
          n'apprend rien, il ne doit pas voler le premier regard au chiffre. */}
      <div className="flex flex-wrap items-center justify-between gap-12">
        {/* h1 conservé pour la structure de titres (accessibilité), mais
            visuellement discret : il n'apprend rien à l'utilisateur. */}
        <h1 className="text-label font-medium uppercase tracking-wide text-foggy">
          Tableau de bord
        </h1>
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
        // Le squelette préfigure la forme réelle du héros (pourcentage +
        // barre + verdict + sparkline + 3 blocs) : un squelette qui ne
        // ressemble pas au contenu final fait « sauter » la mise en page
        // à l'arrivée des données.
        <Card
          aria-busy="true"
          aria-label="Chargement du mois"
          className="rounded-xl p-24 sm:p-32"
        >
          <Skeleton className="h-16 w-[160px]" />
          <Skeleton className="mt-8 h-[44px] w-[220px] sm:h-[56px]" />
          <Skeleton className="mt-20 h-8 w-full" />
          <Skeleton className="mt-16 h-14 w-[300px] max-w-full" />
          <Skeleton className="mt-24 h-12 w-full sm:h-16" />
          <div className="mt-24 grid grid-cols-2 gap-x-16 gap-y-16 border-t border-bebe pt-20 sm:grid-cols-3">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
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
          <Card className="rounded-xl p-24 sm:p-32">
            <p className="text-label font-medium text-foggy">
              Loyers encaissés · {monthLabel(period)}
            </p>

            {/* LA RÉPONSE : le pourcentage en grand. Les montants qui le
                justifient passent en légende — la preuve, pas la réponse. */}
            {noRentExpected ? (
              <p className="mt-8 text-heading font-bold text-hof">
                Aucun loyer attendu ce mois-ci
              </p>
            ) : (
              <div className="mt-8 flex flex-wrap items-baseline gap-x-12 gap-y-4">
                <span className="text-[44px] font-bold leading-none tracking-[-1.5px] tabular-nums text-hof sm:text-[56px]">
                  {pct}%
                </span>
                <span className="text-body text-foggy">
                  <span className="whitespace-nowrap tabular-nums font-medium text-hof">
                    {formatFCFA(s.collectedRent)}
                  </span>{" "}
                  sur{" "}
                  <span className="whitespace-nowrap tabular-nums">
                    {formatFCFA(s.expectedRent)}
                  </span>{" "}
                  FCFA attendus
                </span>
              </div>
            )}

            {/* Le verdict suit IMMÉDIATEMENT le chiffre : c'est LUI la
                réponse « bon / pas bon », il ne doit pas attendre après
                la barre et le sparkline. */}
            {verdict && (
              <p className="mt-12 flex items-center gap-8 text-body">
                <span
                  aria-hidden="true"
                  className={`h-8 w-8 shrink-0 rounded-full ${
                    verdict.tone === "success"
                      ? "bg-success"
                      : verdict.tone === "warning"
                        ? "bg-warning"
                        : "bg-foggy"
                  }`}
                />
                <span className="font-medium text-hof">{verdict.text}</span>
              </p>
            )}

            {/* Barre + tendance : sans loyer attendu, un taux n'a pas de
                sens — on les masque plutôt que d'afficher une barre vide. */}
            {!noRentExpected && (
              <div
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Part du loyer attendu déjà encaissée"
                className="relative mt-20 h-8 w-full overflow-hidden rounded-full bg-faint"
              >
                <div
                  className="h-full rounded-full bg-hof transition-[width] duration-300 ease-out motion-reduce:transition-none"
                  style={{ width: `${Math.min(rate, 1) * 100}%` }}
                />
              </div>
            )}

            {/* La tendance : 6 mois d'encaissements. Répond à « le mois
                est-il bon ? » par comparaison, ce qu'aucun chiffre isolé
                ne fait. */}
            <Sparkline data={s.trend} />

            {/* Trois faits de natures différentes : trois blocs, plus la
                phrase à points médians qui forçait à segmenter soi-même. */}
            <dl className="mt-24 grid grid-cols-2 gap-x-16 gap-y-16 border-t border-bebe pt-20 sm:grid-cols-3">
              <div>
                <dt className="text-label text-foggy">Reste dû</dt>
                <dd className="mt-2 text-ui font-semibold tabular-nums text-hof">
                  {formatFCFA(s.outstandingRent)}
                </dd>
              </div>
              <div>
                <dt className="text-label text-foggy">Cautions détenues</dt>
                <dd className="mt-2 text-ui font-semibold tabular-nums text-hof">
                  {formatFCFA(s.depositsHeld)}
                </dd>
              </div>
              <div>
                <dt className="text-label text-foggy">Occupation</dt>
                <dd className="mt-2 text-ui font-semibold tabular-nums text-hof">
                  {s.occupancy.occupied}/{s.occupancy.total}
                </dd>
              </div>
            </dl>
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
                  // Liste de PERSONNES, pas un tableau : 1 à 5 impayés
                  // typiques sont des gens à relancer, pas des lignes à
                  // trier. Chaque ligne mène à la fiche du bail ; le
                  // retard est nommé, l'action est offerte.
                  <ul className="flex flex-col">
                    {/* Le plus en retard d'abord : la couleur rouge et
                        l'action pleine tombent en tête, là où l'œil va. */}
                    {[...s.unpaidUnits]
                      .sort((a, b) => b.daysLate - a.daysLate)
                      .map((u, i) => (
                        <li
                          key={u.leaseId}
                          className="flex flex-wrap items-center gap-x-16 gap-y-8 border-b border-bebe p-12 last:border-b-0"
                        >
                          <Link
                            href={`/baux?lease=${u.leaseId}`}
                            // focus-visible : ce lien enveloppe le nom du
                            // locataire, cible clavier au même titre que le
                            // bouton d'action — sans remplacement, la nav
                            // clavier y devenait invisible (PRODUCT.md).
                            className="group min-w-0 flex-1 rounded-lg outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hof"
                          >
                            <p className="truncate font-medium text-hof group-hover:underline">
                              {u.tenantName ?? "Sans locataire nommé"}
                            </p>
                            <p className="mt-2 flex items-center gap-8 text-label text-foggy">
                              <span>{u.label}</span>
                              <LateBadge days={u.daysLate} />
                            </p>
                          </Link>
                          <span className="font-semibold tabular-nums text-hof">
                            {formatFCFA(u.due)}
                          </span>
                          {/* « Un seul accent » : le rausch PLEIN est réservé
                              au plus urgent (en tête). Les autres gardent la
                              même action, en variante sobre — sinon 5 taches
                              corail se disputent l'attention et l'accent cesse
                              de désigner l'action primordiale. */}
                          <Link
                            href={`/paiements?lease=${u.leaseId}`}
                            className={`inline-flex h-32 items-center rounded-lg px-12 text-label font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hof ${
                              i === 0
                                ? "bg-rausch text-white hover:bg-rausch-600"
                                : "text-hof hover:bg-faint"
                            }`}
                          >
                            Enregistrer un paiement
                          </Link>
                        </li>
                      ))}
                  </ul>
                )}
              </Card>
            </section>

            <section aria-labelledby="titre-activite">
              <h2
                id="titre-activite"
                className="mb-12 flex items-center gap-8 text-heading-sm font-medium text-hof"
              >
                Activité
                {/* L'état suit vraiment le flux : vert pulsant si
                    connecté, gris « Reconnexion… » sinon. La pastille
                    toujours verte mentait quand le SSE était coupé. */}
                <span className="flex items-center gap-4 text-caption font-semibold text-foggy">
                  <span
                    aria-hidden="true"
                    className={`h-8 w-8 rounded-full ${
                      connected
                        ? "bg-success animate-live-pulse"
                        : "bg-grey-500"
                    }`}
                  />
                  {connected ? "En direct" : "Reconnexion…"}
                </span>
              </h2>
              <Card className="p-4">
                {history.isPending ? (
                  <div className="flex flex-col gap-12 p-12">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-[80%]" />
                    <Skeleton className="h-14 w-[90%]" />
                  </div>
                ) : history.isError && feed.length === 0 ? (
                  // Une panne ne doit PAS se déguiser en « rien à signaler » :
                  // sur écran d'argent, un faux calme détruit la confiance.
                  <div className="flex flex-col items-start gap-8 p-16">
                    <p className="text-body text-hof">
                      Impossible de charger l&apos;activité.
                    </p>
                    <Button variant="ghost" onClick={() => history.refetch()}>
                      Réessayer
                    </Button>
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
