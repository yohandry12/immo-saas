# Dashboard : cartes de suivi + correctif vigueur des baux — Design

**Date :** 2026-08-10
**Statut :** validé, prêt pour le plan d'implémentation

## Contexte

Le dashboard propriétaire répond à « le mois est-il bon ? » via une carte
héros (% encaissé, verdict, sparkline 6 mois), suivie des impayés et de
l'activité. Deux évolutions sont demandées :

1. **Un correctif de bug (urgent).** Un bail actif compte comme *attendu*
   et *impayé* pour n'importe quel mois, même avant sa date de début. Un
   locataire arrivé en août apparaît « impayé » quand on consulte juin.
2. **Une nouvelle fonctionnalité.** Une rangée de 4 cartes de suivi sous le
   héros : patrimoine, encaissé 6 mois, occupation, dépenses du mois.

Ces deux travaux touchent les mêmes fichiers
(`apps/api/src/modules/dashboard/service.ts`, `packages/shared/src/index.ts`,
`apps/web/src/app/(app)/dashboard/page.tsx`). Le correctif se livre en
premier : il définit ce que les cartes comptent.

## Contraintes globales (DESIGN.md / PRODUCT.md)

- **Un SEUL accent corail** (`--color-rausch`), réservé à UNE action
  primordiale par écran. Les cartes de suivi INFORMENT, n'agissent pas :
  **jamais de corail dessus**.
- **Galerie blanche** : cartes blanches, séparation par valeur (hairline
  `border-bebe`), pas d'ombre décorative, pas de flou, pas de dégradé.
  Le glassmorphisme est explicitement écarté.
- **Léger pour la 3G** : pas de `backdrop-blur`, pas de dépendance nouvelle.
- **Espacement en px vrais** (échelle du design), typographie du système
  (`text-label`, `text-ui`, `tabular-nums` pour les chiffres).
- **Le chiffre héros garde le premier regard** (PRODUCT.md principe 1) :
  les cartes se placent SOUS le héros.
- **Montants FCFA** via `formatFCFA()` uniquement (n'ajoute jamais « FCFA »
  en dur à côté — le helper le fait déjà).

## Tâche 1 — Correctif : vigueur des baux

### Le défaut

`getSummary` charge les baux avec `where: { endDate: null }` puis, pour
chaque bail actif, l'ajoute à `expectedRent` / `unpaidUnits` / `occupied`
pour le mois demandé **sans vérifier que le bail était en vigueur ce
mois-là**. Un bail à `startDate = 2026-08-01`, `endDate = null` est donc
compté comme attendu et impayé en juin 2026.

De plus, le pré-filtre `endDate: null` empêche tout bail terminé de
remonter : consulter un mois passé où un bail *aujourd'hui terminé* était
pourtant en vigueur l'omet de l'historique.

### La règle : « en vigueur »

Un bail compte dans un mois `period` (format « AAAA-MM ») si et seulement si :

```
monthOf(startDate) <= period  ET  (endDate est null  OU  period <= monthOf(endDate))
```

où `monthOf(d) = d.toISOString().slice(0, 7)` (déjà défini dans le service).
La comparaison est au **mois** près, cohérente avec la convention existante
« loyer dû en début de mois ».

### Changements

Fichier : `apps/api/src/modules/dashboard/service.ts`

1. **Requête** : retirer `where: { endDate: null }` du `include.leases` ;
   charger tous les baux de chaque appartement avec `startDate` et
   `endDate` dans le `select`.
2. **Sélection du bail courant** : un appartement peut avoir plusieurs
   baux successifs. Pour un `period` donné, filtrer les baux dont la période
   de vie contient `period` (règle « en vigueur » ci-dessus). La base
   garantit un seul bail ACTIF (endDate null) par appartement, mais pas
   l'absence de chevauchement entre baux passés ; donc si plusieurs baux
   sont en vigueur pour `period`, choisir de façon déterministe le plus
   récemment démarré (`startDate` max). S'il n'y en a aucun, l'appartement
   est vide ce mois-là (ni attendu, ni impayé, ni occupé).
3. **Boucle des impayés** : n'ajouter à `expectedRent`, `occupied` et
   `unpaidUnits` que si un bail en vigueur existe pour `period`.
4. **`previousAtSameDay.prevExpected`** : recalculer l'attendu du mois
   précédent avec les baux en vigueur `shiftMonth(period, -1)`, pas en
   réutilisant `expectedRent` du mois courant (les baux en vigueur peuvent
   différer d'un mois à l'autre).
5. **Tendance (`trend[]`)** : l'encaissé par mois vient des paiements, déjà
   juste. Aucun changement requis pour l'encaissé. (L'attendu par mois
   n'est pas exposé dans `trend` aujourd'hui ; on ne l'ajoute pas.)

### Ce qui ne change PAS

- `SummaryResponse` : la forme reste identique pour la Tâche 1 (le
  correctif ne fait que rendre les nombres justes).
- La règle « un seul bail actif par appartement » (contrainte base) tient.

## Tâche 2 — Les 4 cartes de suivi

### Backend

Fichier : `apps/api/src/modules/dashboard/service.ts` +
`packages/shared/src/index.ts`.

`SummaryResponse` gagne deux champs :

```ts
portfolio: {
  buildings: number;      // nb d'immeubles de l'org
  units: number;          // nb total d'appartements
  activeTenants: number;  // nb de baux EN VIGUEUR le mois demandé
};
monthlyExpenses: number;  // somme des dépenses du mois demandé (FCFA)
```

- `portfolio.buildings` / `portfolio.units` : comptés sur les données déjà
  chargées (`units` et leurs immeubles) ou via `count` léger. Ne dépendent
  pas du mois, mais fournis dans le summary pour éviter un second appel
  réseau (important 3G).
- `portfolio.activeTenants` : nombre d'appartements avec un bail en vigueur
  le mois demandé — réutilise exactement le compteur `occupied` déjà
  calculé par la boucle corrigée en Tâche 1. (Un locataire = un bail en
  vigueur ; convention MVP.)
- `monthlyExpenses` : somme des `Expense` de l'org dont `createdAt` tombe
  dans le mois `period`. Requête `aggregate` bornée sur `[début, fin[` du
  mois. Une requête de plus, légère (indexée `orgId`).

`occupancy` et `trend[]` existent déjà et sont réutilisés tels quels par
les cartes (occupation, encaissé 6 mois).

### Frontend

Nouveau composant : `apps/web/src/components/ui/StatCard.tsx`.
Modifié : `apps/web/src/app/(app)/dashboard/page.tsx`.

**Placement** : une rangée `grid grid-cols-2 gap-16 lg:grid-cols-4`, insérée
**après la carte héros, avant la section impayés + activité**. Sur mobile :
2×2. Masquée quand le portefeuille est vide (`occupancy.total === 0`), comme
le héros.

**Anatomie d'une `StatCard`** (structure inspirée de l'image de référence,
rendue en thème blanc) :
- carte blanche, `border border-bebe`, `rounded-cards`, padding cohérent
- pastille ronde libellée/icône en tête (même langage rond que les
  initiales de la Topbar), en gris neutre — **jamais** corail
- libellé discret (`text-label text-foggy`)
- chiffre principal en avant (`text-ui`/24px, `font-semibold`, `tabular-nums`)
- détail secondaire dessous (`text-label text-foggy`)

**Les 4 cartes :**

| Carte | Chiffre principal | Détail | Source |
|---|---|---|---|
| **Patrimoine** | `{units}` appartements | `{buildings} immeubles · {activeTenants} locataires` | `portfolio` |
| **Encaissé** | `formatFCFA(collectedRent)` | mini-barres 6 mois (façon « Income $3.5K ») | `trend[]` |
| **Occupation** | `{occupied}/{total}` | `{rate}%` | `occupancy` |
| **Dépenses du mois** | `formatFCFA(monthlyExpenses)` | libellé « ce mois-ci » | `monthlyExpenses` |

**Mini-barres de la carte Encaissé** : réutiliser la donnée `trend[]`
(6 points). Un petit graphe à barres pur SVG (aucune dépendance), même
esprit que le `Sparkline` existant : baseline zéro, dernière barre mise en
évidence, `role="img"` + `aria-label` décrivant la tendance. Complémentaire
du sparkline du héros (le sparkline donne la forme, la carte donne le
montant du mois) — option (a) retenue explicitement.

### Accessibilité

- Chaque carte : le chiffre et son libellé associés sémantiquement
  (structure `<dl>`/`<dt>`/`<dd>` ou libellé + valeur clairement liés).
- Le mini-graphe : `role="img"` + `aria-label` textuel (pas de sens porté
  par la seule couleur).
- Contrastes : texte gris `text-foggy` (#6a6a6a) sur blanc = ≥ 4.5:1 pour
  les libellés ; le chiffre en `text-hof` (#222).

## Tests

- **Tâche 1** : vérifier contre le serveur réel avec un compte jetable —
  créer un immeuble + appartement + bail `startDate` au mois courant, puis
  interroger le summary d'un mois ANTÉRIEUR au `startDate` : l'appartement
  ne doit apparaître ni dans `expectedRent`, ni dans `unpaidUnits`, ni dans
  `occupied`. Interroger le mois de `startDate` : il doit apparaître.
  **Nettoyer les données de test après.** Ne jamais lancer
  `test:isolation` (destructif).
- **Tâche 2** : vérifier que `portfolio` et `monthlyExpenses` remontent des
  valeurs justes contre le serveur réel (compte jetable), puis nettoyer.
  Front : `tsc --noEmit` propre + `next build` vert.

## Hors périmètre (YAGNI)

- Pas de recherche globale (aucune fonctionnalité de recherche n'existe).
- Pas d'attendu par mois dans `trend[]` (non demandé par les cartes).
- Pas de comparaison période/période sur les cartes (delta `↑12%` de
  l'image) : les données historiques par métrique n'existent que pour
  l'encaissé (via `trend`) ; ajouter un delta aux autres cartes exigerait
  de nouvelles séries. Différé.
