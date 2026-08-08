---
target: dashboard
total_score: 24
p0_count: 2
p1_count: 2
timestamp: 2026-08-08T00-55-28Z
slug: apps-web-src-app-app-dashboard-page-tsx
---
## Design Health Score

| # | Heuristique | Score | Problème clé |
|---|---|---|---|
| 1 | Visibilité de l'état | 3 | Pastille « En direct » pulse en permanence : `connected` lu (page.tsx:34) jamais utilisé à l'affichage (page.tsx:229) |
| 2 | Correspondance monde réel | 4 | Excellent. « MTN MoMo », « caution », « reste dû », FCFA entiers, dates françaises |
| 3 | Contrôle et liberté | 2 | `<input type="month">` brut, widget natif hostile sur Safari/iOS |
| 4 | Cohérence | 2 | Système typographique doublé : tokens nommés + text-[13px]/[14px]/[12px] arbitraires |
| 5 | Prévention des erreurs | 3 | `max={currentPeriod()}` et garde sur la division : correct |
| 6 | Reconnaissance | 2 | Trois faits hétérogènes dans un paragraphe gris séparé par points médians (page.tsx:153-175) |
| 7 | Flexibilité | 1 | Impayés non cliquables. L'écran informe puis abandonne |
| 8 | Esthétique et sobriété | 2 | Sobre oui, esthétique non. Aucun rausch sur l'écran peuplé |
| 9 | Récupération d'erreur | 3 | `history.isError` jamais testé : une panne s'affiche « Rien à signaler » |
| 10 | Aide | 2 | Rien n'explique « Cautions détenues » ni la barre de progression |
| **Total** | | **24/40** | **Acceptable — améliorations significatives nécessaires** |

## Verdict anti-patterns

Pas du slop IA : de l'inachevé. Aucun tell classique (pas de cartes-métriques clonées, pas de gradient, pas d'eyebrow, pas de bordure latérale colorée). Le problème est l'inverse du slop : la retenue est allée jusqu'à l'absence de design. Le principe « un seul accent » est devenu « aucun accent ».

Scan déterministe `detect.mjs` sur dashboard + shell + composants UI : `[]`, zéro finding, exit 0. Cette divergence (détecteur muet / interface jugée moche) confirme le diagnostic de sous-décoration.

Overlays visuels non tentés : dev server non lancé, gain marginal, diagnostic tenu sur le code.

## Impression d'ensemble

Fondations saines et rares : langue travaillée, montants disciplinés (tabular-nums, whitespace-nowrap), accessibilité traitée comme exigence. Ce qui manque n'est pas du polish mais de la hiérarchie.

Plus grande opportunité : l'écran donne les données de la réponse, pas la réponse. PRODUCT.md promet « savoir en 10 secondes si le mois est bon ». L'écran affiche « X sur Y attendus » + barre grise. Le pourcentage est calculé (page.tsx:65), passé aux lecteurs d'écran (page.tsx:142), jamais montré aux yeux.

## Ce qui fonctionne

1. **La langue** — `activity.ts` traduit chaque événement en français naturel, moyens de paiement nommés comme le pays les nomme. Travail d'écriture, pas de remplissage.
2. **La discipline des chiffres** — tabular-nums partout, whitespace-nowrap, cas mobile pensé explicitement (commentaire page.tsx:131).
3. **L'honnêteté des états de chargement** — skeletons dimensionnés comme le contenu réel, aria-busy, role="progressbar" correct, prefers-reduced-motion global.

## Priority Issues

### [P0] L'écran ne répond pas à sa propre question — page.tsx:123-176
Sans référence temporelle ni verdict, le persona ne peut pas conclure ; il appelle son gestionnaire. Promesse centrale manquée.
Fix : pourcentage en héros (40-48px), montants en légende, phrase de verdict, étendre SummaryResponse avec le mois précédent. Supprimer le h1 28px qui vole le premier regard à poids égal.
Commande : /impeccable layout puis /impeccable typeset

### [P0] Le shell n'a aucune présence — Sidebar.tsx:20-55, Topbar.tsx:29-44
Cadre permanent de tous les écrans ; sans qualité il dégrade tout. Écart principal avec la référence Resend.
Fix : icônes stroke 1.5px, état actif à trois signaux, séparation métier/administration, dé-hiérarchiser « Déconnexion » (actuellement l'élément le plus contrasté de la topbar).
Commande : /impeccable polish

### [P1] Cartes invisibles en conditions réelles — Card.tsx:11
#fff sur #f7f7f7 = 2 % de delta. Android milieu de gamme, le soir : les cartes n'existent pas. Resend utilise des hairlines.
Fix : border border-bebe.
Commande : /impeccable polish

### [P1] Les impayés n'offrent aucune action — page.tsx:194-215
Seul contenu actionnable, motif principal d'ouverture. hover:bg-faint promet une interactivité inexistante. Renvoie au téléphone, ce que le produit prétend remplacer.
Fix : lignes cliquables, colonne « Retard », rausch ici.
Commande : /impeccable craft (champ backend requis)

### [P2] Deux mensonges d'état — page.tsx:226-245
Pastille « En direct » inconditionnelle ; history.isError jamais testé. Sur 3G, quotidien. Faux « tout va bien » sur écran d'argent.
Commande : /impeccable harden

## Persona Red Flags

**Propriétaire diaspora** : jusqu'à 15 s de rond gris sans contexte ni cache. Aucune comparaison temporelle. Aucun point de fixation coloré — l'œil balaie au lieu d'atterrir.

**Gestionnaire local** : 8 pilules en scroll horizontal sans indicateur d'overflow (2 items invisibles). Cibles tactiles ~36px vs ≥44px exigé par PRODUCT.md. SSE permanent sans condition de visibilité, coûteux en data.

## Minor Observations

- `--text-heading` line-height 1.43 hérité du corps (globals.css:37) vs 1.18-1.20 ailleurs : le chiffre central est mou.
- 13px absent de DESIGN.md, pourtant taille la plus utilisée du produit.
- gap-24 uniforme alors que DESIGN.md prescrit 48px entre sections.
- Aucun focus-visible dans les composants UI, exigé par PRODUCT.md.
- CardTitle : composant mort.
- bg-[#1e7e34] en dur (page.tsx:229) alors que Badge.tsx:9 définit la même couleur ; aucun token sémantique.
- Barre de progression sans repère : pas de marqueur du prorata attendu à cette date.

## Questions to Consider

1. Le pourcentage est calculé et caché. Si c'est la réponse, pourquoi est-ce la seule chose que les yeux ne voient pas ?
2. Quelle est l'action primordiale de cet écran ? Sans action, est-ce un dashboard ou un relevé ?
3. Un tableau est-il la bonne forme pour trois impayés ? Ce sont des personnes, pas des lignes à trier.
4. Resend fait du graphique son centre. L'absence de graphique vient-elle du principe « pas de graphiques décoratifs », ou le principe a-t-il servi d'excuse ?
