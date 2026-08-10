# Dashboard : cartes de suivi + correctif vigueur des baux — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger le bug « impayé fantôme » (un bail compte avant son début) et ajouter 4 cartes de suivi sous le héros du dashboard.

**Architecture:** Le calcul reste en mémoire dans `getSummary` (lisible, migrable SQL plus tard). Le correctif charge TOUS les baux et filtre par vigueur au mois près. Les cartes ajoutent deux champs à `SummaryResponse` (`portfolio`, `monthlyExpenses`) et un composant frontend `StatCard`. Tests d'intégration contre le serveur réel via scripts à compte jetable.

**Tech Stack:** Express 5 + Prisma (apps/api), types partagés zod/TS (packages/shared), Next.js 16 + Tailwind v4 (apps/web).

## Global Constraints

- **Un SEUL accent corail** (`--color-rausch`), réservé à UNE action primordiale par écran. Les cartes de suivi n'ont JAMAIS de corail.
- **Galerie blanche** : cartes blanches, hairline `border-bebe`, pas d'ombre, pas de flou, pas de dégradé, pas de glassmorphisme.
- **Léger 3G** : aucune dépendance nouvelle, pas de `backdrop-blur`.
- **Montants FCFA** via `formatFCFA()` uniquement — n'ajoute JAMAIS « FCFA » en dur à côté.
- **Vigueur d'un bail** dans un mois `period` (« AAAA-MM ») : `monthOf(startDate) <= period && (endDate === null || period <= monthOf(endDate))`, au mois près.
- **NE JAMAIS lancer `test:isolation`** (destructif, vide les tables). Les tests créent des comptes jetables, n'effacent aucune donnée existante.
- `tabular-nums` sur tout chiffre ; typographie du système (`text-label`, `text-ui`).

---

### Task 1 : Correctif vigueur des baux dans `getSummary`

**Files:**
- Modify: `apps/api/src/modules/dashboard/service.ts:12-158`

**Interfaces:**
- Consumes: `prisma.unit.findMany`, `monthOf`, `shiftMonth` (déjà présents).
- Produces: `getSummary(orgId, period)` inchangé en signature ET en forme de retour ; seuls les NOMBRES deviennent justes. `occupied` (compteur local) devient « appartements avec bail en vigueur le mois demandé » — réutilisé en Task 3.

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `apps/api/src/scripts/testLeaseInForce.ts` (nouveau script d'intégration, modèle : `testDashboard.ts`). Il crée une org jetable, 1 immeuble, 1 appartement, 1 bail dont `startDate` est le mois COURANT, puis interroge le summary d'un mois ANTÉRIEUR.

```ts
// Teste la règle de vigueur : un bail ne compte pas avant son startDate.
// Terminal A : pnpm --filter @immo/api dev
// Terminal B : pnpm --filter @immo/api test:leaseinforce
import "dotenv/config";
import assert from "node:assert";

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const now = new Date();
const CURRENT = now.toISOString().slice(0, 7);
const PREVIOUS = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  .toISOString()
  .slice(0, 7);

const headers = (token: string, orgId: string) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
  "X-Org-Id": orgId,
});

async function main() {
  const reg = await (
    await fetch(`${BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: `inforce-${Date.now()}@test.cm`,
        password: "password123",
        firstName: "Test",
        lastName: "InForce",
        orgName: "Vigueur Test",
      }),
    })
  ).json();
  const h = headers(reg.token, reg.org.id);

  const building = await (
    await fetch(`${BASE}/buildings`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ name: "Résidence Vigueur", city: "Douala" }),
    })
  ).json();
  const unit = await (
    await fetch(`${BASE}/buildings/${building.id}/units`, {
      method: "POST",
      headers: h,
      body: JSON.stringify({ label: "V1", rentAmount: 50000 }),
    })
  ).json();
  // Bail qui DÉBUTE ce mois-ci.
  await fetch(`${BASE}/leases`, {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      unitId: unit.id,
      tenantName: "Martin Tardif",
      tenantPhone: "+237699000123",
      // CreateLeaseSchema veut un datetime ISO complet (.datetime()),
      // pas "YYYY-MM-DD". 1er du mois courant à minuit UTC.
      startDate: new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
      ).toISOString(),
    }),
  });

  // Mois ANTÉRIEUR au bail : rien ne doit compter.
  const prev = await (
    await fetch(`${BASE}/dashboard/summary?period=${PREVIOUS}`, { headers: h })
  ).json();
  assert.equal(prev.expectedRent, 0, "aucun attendu avant le début du bail");
  assert.equal(prev.unpaidUnits.length, 0, "aucun impayé avant le début du bail");
  assert.equal(prev.occupancy.occupied, 0, "aucun occupé avant le début du bail");

  // Mois du bail : il doit compter.
  const cur = await (
    await fetch(`${BASE}/dashboard/summary?period=${CURRENT}`, { headers: h })
  ).json();
  assert.equal(cur.expectedRent, 50000, "attendu = 1 bail en vigueur");
  assert.equal(cur.unpaidUnits.length, 1, "1 impayé le mois du bail");
  assert.equal(cur.occupancy.occupied, 1, "1 occupé le mois du bail");

  console.log("✅ Vigueur des baux vérifiée : ni avant le début, oui au mois du bail — OK");
}

main().catch((e) => {
  console.error("❌ Test échoué :", e.message);
  process.exitCode = 1;
});
```

Ajouter le script dans `apps/api/package.json` :
```json
"test:leaseinforce": "tsx src/scripts/testLeaseInForce.ts",
```

`POST /leases` accepte `startDate` (vérifié : `CreateLeaseSchema.startDate`, ISO `.datetime()` optionnel ; le service pose `new Date(startDate)` sinon `now`). Le test l'envoie au 1er du mois courant.

- [ ] **Step 2 : Lancer le test, vérifier qu'il échoue**

Serveur lancé (Terminal A : `pnpm --filter @immo/api dev`, Docker up pour Postgres/Redis).
Run : `pnpm --filter @immo/api test:leaseinforce`
Attendu : ÉCHEC sur `prev.expectedRent === 0` (le code actuel compte le bail à 50000 même en mois antérieur).

- [ ] **Step 3 : Corriger la requête — charger tous les baux**

Dans `apps/api/src/modules/dashboard/service.ts`, remplacer le `include.leases` filtré :

```ts
prisma.unit.findMany({
  where: { building: { orgId } },
  // On charge TOUS les baux (pas seulement les actifs) : la vigueur au
  // mois demandé se décide en mémoire, sinon un bail terminé disparaît de
  // l'historique et un bail futur pollue les mois antérieurs.
  include: {
    leases: {
      select: {
        id: true,
        rentAmount: true,
        tenantName: true,
        startDate: true,
        endDate: true,
      },
    },
  },
}),
```

- [ ] **Step 4 : Sélectionner le bail en vigueur au mois demandé**

Juste avant la boucle `for (const unit of units)`, ajouter un helper de vigueur. Puis, dans la boucle, remplacer `const lease = unit.leases[0] ?? null;` par la sélection filtrée :

```ts
// Un bail est « en vigueur » le mois demandé s'il a commencé (au mois
// près) et n'est pas terminé avant. La base garantit un seul bail ACTIF
// par appartement, mais pas l'absence de chevauchement entre baux passés :
// en cas d'ambiguïté, on prend le plus récemment démarré.
const inForce = (l: { startDate: Date; endDate: Date | null }) =>
  monthOf(l.startDate) <= period &&
  (l.endDate === null || period <= monthOf(l.endDate));

// ... dans la boucle :
const lease =
  unit.leases
    .filter(inForce)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0] ?? null;
if (!lease) continue; // appartement vide CE mois-là : ni attendu, ni impayé
```

`occupied += 1` et `expectedRent += lease.rentAmount` restent inchangés dessous : ils ne s'exécutent désormais que pour un bail en vigueur.

- [ ] **Step 5 : Corriger `prevExpected` (comparaison mois -1)**

`prevExpected` réutilise aujourd'hui `expectedRent` (le mois courant). Un bail peut être en vigueur un mois mais pas l'autre. Recalculer l'attendu du mois précédent :

```ts
const prevPeriodStr = shiftMonth(period, -1);
const inForcePrev = (l: { startDate: Date; endDate: Date | null }) =>
  monthOf(l.startDate) <= prevPeriodStr &&
  (l.endDate === null || prevPeriodStr <= monthOf(l.endDate));
const prevExpected = units.reduce((sum, u) => {
  const l = u.leases
    .filter(inForcePrev)
    .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))[0];
  return sum + (l ? l.rentAmount : 0);
}, 0);
```

Remplacer la ligne `const prevExpected = expectedRent;` par ce bloc. `prevPeriod` (déjà défini à `shiftMonth(period, -1)`) et `prevPeriodStr` sont la même valeur ; réutiliser la variable existante `prevPeriod` au lieu d'en créer une seconde.

- [ ] **Step 6 : Lancer le test, vérifier qu'il passe**

Run : `pnpm --filter @immo/api test:leaseinforce`
Attendu : `✅ Vigueur des baux vérifiée … OK`.
Puis relancer le test dashboard existant pour non-régression :
Run : `pnpm --filter @immo/api test:dashboard`
Attendu : `✅ Dashboard vérifié … OK` (les baux du script démarrent au mois courant, donc restent comptés).

- [ ] **Step 7 : tsc de l'API**

Run : `pnpm --filter @immo/api build`
Attendu : compile sans erreur.

- [ ] **Step 8 : Commit**

```bash
git add apps/api/src/modules/dashboard/service.ts apps/api/src/scripts/testLeaseInForce.ts apps/api/package.json
git commit -m "Dashboard : un bail ne compte que s'il etait en vigueur ce mois-la"
```

---

### Task 2 : Backend des cartes — `portfolio` + `monthlyExpenses`

**Files:**
- Modify: `apps/api/src/modules/dashboard/service.ts`
- Modify: `packages/shared/src/index.ts:382-407`
- Modify: `apps/api/src/scripts/testDashboard.ts` (ajout d'assertions)

**Interfaces:**
- Consumes: `units` (déjà chargé), `occupied` (compteur de Task 1), `prisma.expense.aggregate`.
- Produces: `SummaryResponse` gagne `portfolio: { buildings, units, activeTenants }` et `monthlyExpenses: number`.

- [ ] **Step 1 : Étendre `SummaryResponse` dans shared**

Dans `packages/shared/src/index.ts`, à la fin du type `SummaryResponse` (avant la `}` ligne 407) :

```ts
  // Taille du portefeuille : ne dépend pas du mois, mais fourni ici pour
  // éviter un second appel réseau (important sur 3G).
  portfolio: {
    buildings: number;
    units: number;
    activeTenants: number; // baux en vigueur le mois demandé
  };
  // Dépenses déclarées ce mois : le « sortant » face au « rentrant ».
  monthlyExpenses: number;
```

- [ ] **Step 2 : Ajouter les assertions au test dashboard (échouera)**

Dans `apps/api/src/scripts/testDashboard.ts`, après le bloc d'assertions du summary (après ligne 118), ajouter :

```ts
  assert.deepEqual(
    summary.portfolio,
    { buildings: 1, units: 2, activeTenants: 2 },
    "portefeuille : 1 immeuble, 2 apparts, 2 baux en vigueur",
  );
  assert.equal(summary.monthlyExpenses, 0, "aucune dépense ce mois");
```

Run : `pnpm --filter @immo/api test:dashboard`
Attendu : ÉCHEC (`summary.portfolio` est `undefined`).

- [ ] **Step 3 : Calculer les champs dans `getSummary`**

Dans `service.ts`, avant le `return`, calculer les dépenses du mois et les compteurs. Ajouter la requête dépenses au `Promise.all` initial pour éviter un aller-retour séquentiel :

```ts
// Bornes du mois demandé, en UTC : [1er du mois, 1er du mois suivant[.
const [yy, mm] = period.split("-").map(Number);
const monthStart = new Date(Date.UTC(yy, mm - 1, 1));
const monthEnd = new Date(Date.UTC(yy, mm, 1));
```

Ajouter dans le `Promise.all` (ligne 13) un troisième élément :
```ts
prisma.expense.aggregate({
  where: { orgId, createdAt: { gte: monthStart, lt: monthEnd } },
  _sum: { amount: true },
}),
```
et déstructurer `const [units, payments, expenseAgg] = await Promise.all([...])`.
(Déplacer le calcul de `monthStart`/`monthEnd` AVANT le `Promise.all`.)

`buildings` = nombre d'immeubles distincts parmi les `units` chargés :
```ts
const buildingIds = new Set(units.map((u) => u.buildingId));
```

Dans l'objet retourné, ajouter :
```ts
    portfolio: {
      buildings: buildingIds.size,
      units: units.length,
      activeTenants: occupied, // baux en vigueur (compteur de la boucle)
    },
    monthlyExpenses: expenseAgg._sum.amount ?? 0,
```

Vérifier que `u.buildingId` est bien sélectionné (il l'est par défaut, `findMany` ramène les scalaires du modèle).

- [ ] **Step 4 : Lancer le test dashboard, vérifier qu'il passe**

Run : `pnpm --filter @immo/api test:dashboard`
Attendu : toutes les assertions passent, y compris `portfolio` et `monthlyExpenses`.

- [ ] **Step 5 : tsc API + shared**

Run : `pnpm --filter @immo/shared build && pnpm --filter @immo/api build`
Attendu : compilent sans erreur.

- [ ] **Step 6 : Commit**

```bash
git add apps/api/src/modules/dashboard/service.ts packages/shared/src/index.ts apps/api/src/scripts/testDashboard.ts
git commit -m "Dashboard : summary expose portfolio et depenses du mois"
```

---

### Task 3 : Frontend — composant `StatCard` + mini-barres

**Files:**
- Create: `apps/web/src/components/ui/StatCard.tsx`
- Create: `apps/web/src/components/ui/MiniBars.tsx`

**Interfaces:**
- Consumes: rien (composants purs).
- Produces: `StatCard` (carte de suivi réutilisable), `MiniBars` (graphe à barres SVG pur pour la carte Encaissé).

- [ ] **Step 1 : Écrire `StatCard`**

`apps/web/src/components/ui/StatCard.tsx` :

```tsx
import type { ReactNode } from "react";

// Carte de suivi : INFORME, n'agit pas — donc jamais d'accent corail.
// Structure inspirée d'une réf (gros chiffre, libellé discret, détail),
// rendue en thème blanc DESIGN.md : hairline, pas d'ombre, pas de flou.
export function StatCard({
  label,
  icon,
  value,
  detail,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8 rounded-[12px] border border-bebe bg-white p-16">
      <div className="flex items-center gap-8">
        {/* Pastille ronde neutre : même langage rond que les initiales de
            la Topbar, jamais corail (réservé à l'action). */}
        <span
          aria-hidden="true"
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-faint text-foggy"
        >
          {icon}
        </span>
        <span className="text-label text-foggy">{label}</span>
      </div>
      <p className="text-ui font-semibold tabular-nums leading-tight text-hof">
        {value}
      </p>
      {detail && <div className="text-label text-foggy">{detail}</div>}
    </div>
  );
}
```

- [ ] **Step 2 : Écrire `MiniBars`**

`apps/web/src/components/ui/MiniBars.tsx` — graphe à barres SVG pur, même esprit que `Sparkline` (baseline zéro, dernière barre en évidence, `role="img"`).

```tsx
import { monthLabel } from "@/lib/format";

type Point = { period: string; collectedRent: number };

// Mini-barres 6 mois pour la carte « Encaissé » : la forme des
// encaissements récents, dernière barre (mois courant) en évidence.
// SVG pur, aucune dépendance — léger pour la 3G.
export function MiniBars({ data }: { data: Point[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.collectedRent), 1);
  const last = data[data.length - 1];
  return (
    <div
      role="img"
      aria-label={`Encaissements des ${data.length} derniers mois, de ${monthLabel(
        data[0].period,
      )} à ${monthLabel(last.period)}`}
      className="flex h-24 items-end gap-4"
    >
      {data.map((d, i) => {
        const h = Math.round((d.collectedRent / max) * 100);
        const current = i === data.length - 1;
        return (
          <span
            key={d.period}
            className={`w-full rounded-sm ${current ? "bg-hof" : "bg-bebe"}`}
            style={{ height: `${Math.max(h, 6)}%` }}
          />
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3 : tsc web**

Run : `cd apps/web && npx tsc --noEmit`
Attendu : aucune erreur (composants isolés, pas encore utilisés — c'est normal, ils seront consommés en Task 4).

- [ ] **Step 4 : Commit**

```bash
git add apps/web/src/components/ui/StatCard.tsx apps/web/src/components/ui/MiniBars.tsx
git commit -m "Dashboard : composants StatCard et MiniBars (SVG pur, theme blanc)"
```

---

### Task 4 : Frontend — insérer la rangée de 4 cartes dans le dashboard

**Files:**
- Modify: `apps/web/src/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `StatCard`, `MiniBars`, `s.portfolio`, `s.monthlyExpenses`, `s.trend`, `s.occupancy`, `formatFCFA`.
- Produces: rangée de cartes rendue sous le héros, avant la section impayés + activité.

- [ ] **Step 1 : Importer les composants**

En tête de `page.tsx`, ajouter :
```tsx
import { StatCard } from "@/components/ui/StatCard";
import { MiniBars } from "@/components/ui/MiniBars";
```

- [ ] **Step 2 : Insérer la rangée après la carte héros**

Juste APRÈS la fermeture de la `</Card>` du héros (ligne ~278, avant le commentaire `{/* ---- Impayés … ---- */}`), insérer :

```tsx
          {/* ---- Cartes de suivi : le contexte, sous la réponse du mois.
              Elles INFORMENT (jamais de corail). ---- */}
          <div className="grid grid-cols-2 gap-16 lg:grid-cols-4">
            <StatCard
              label="Patrimoine"
              icon={<IconBuilding width={16} height={16} />}
              value={`${s.portfolio.units} appartement${
                s.portfolio.units > 1 ? "s" : ""
              }`}
              detail={
                <>
                  {s.portfolio.buildings} immeuble
                  {s.portfolio.buildings > 1 ? "s" : ""} ·{" "}
                  {s.portfolio.activeTenants} locataire
                  {s.portfolio.activeTenants > 1 ? "s" : ""}
                </>
              }
            />
            <StatCard
              label="Encaissé ce mois"
              icon={<IconBanknote width={16} height={16} />}
              value={formatFCFA(s.collectedRent)}
              detail={<MiniBars data={s.trend} />}
            />
            <StatCard
              label="Occupation"
              icon={<IconGauge width={16} height={16} />}
              value={`${s.occupancy.occupied}/${s.occupancy.total}`}
              detail={`${Math.round(s.occupancy.rate * 100)}% occupé`}
            />
            <StatCard
              label="Dépenses ce mois"
              icon={<IconWrench width={16} height={16} />}
              value={formatFCFA(s.monthlyExpenses)}
              detail="déclarées ce mois-ci"
            />
          </div>
```

Ajouter les imports d'icônes en tête :
```tsx
import {
  IconBanknote,
  IconBuilding,
  IconGauge,
  IconWrench,
} from "@/components/shell/icons";
```

- [ ] **Step 3 : tsc web**

Run : `cd apps/web && npx tsc --noEmit`
Attendu : aucune erreur.

- [ ] **Step 4 : Build web**

Run : `cd apps/web && npx next build`
Attendu : compile, page `/dashboard` générée.

- [ ] **Step 5 : Commit**

```bash
git add "apps/web/src/app/(app)/dashboard/page.tsx"
git commit -m "Dashboard : rangee de 4 cartes de suivi sous le heros"
```

---

## Self-Review

**Couverture du spec :**
- Correctif vigueur (charger tous les baux, filtrer `startDate ≤ mois ≤ endDate`, boucle + prevExpected) → Task 1. ✓
- `portfolio` + `monthlyExpenses` dans `SummaryResponse` → Task 2. ✓
- 4 cartes (patrimoine, encaissé + mini-barres, occupation, dépenses), sous le héros, thème blanc, sans corail → Task 3 + 4. ✓
- Tests contre serveur réel, comptes jetables, jamais `test:isolation` → Task 1 (nouveau script) + Task 2 (assertions ajoutées). ✓

**Cohérence des types :** `occupied` (Task 1) → `activeTenants` (Task 2). `s.trend` alimente `MiniBars` (même type `{ period, collectedRent }[]` que le `Sparkline`). `s.portfolio`/`s.monthlyExpenses` définis en Task 2, consommés en Task 4. ✓

**Placeholders :** aucun — chaque step porte le code exact. ✓

**Vérifié avant écriture :** `POST /leases` accepte `startDate` (ISO datetime) ; `SummaryResponse` lignes 382-407 ; `getSummary` charge `units` + `payments` en `Promise.all` ; `prisma.expense` indexé `orgId` ; `test:dashboard` = script à compte jetable contre serveur réel.
