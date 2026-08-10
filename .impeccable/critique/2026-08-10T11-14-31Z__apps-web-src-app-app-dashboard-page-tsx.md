---
target: dashboard
total_score: 34
p0_count: 0
p1_count: 2
timestamp: 2026-08-10T11-14-31Z
slug: apps-web-src-app-app-dashboard-page-tsx
---
## Re-critique dashboard — 34/40 (etait 24/40)

### Verdict slop IA
Plus de l'inacheve : desormais fini. Commentaires portant des decisions (LateBadge, verdict compare a un montant pas un taux), mensonges d'etat corriges a la racine. Detecteur `[]` (zero tell). Seule trace residuelle : densite de commentaires elevee.

### Heuristiques : 34/40 (etait 24)
Visibilite 4, Monde reel 4, Controle 3, Coherence 3, Prevention 3, Reconnaissance 4, Flexibilite 3, Esthetique 4, Diagnostic erreur 3, Aide 3.

### Charge cognitive : 2 echecs partiels sur 8
- Carte heros a 4 strates (barre + verdict + sparkline + dl) : dense pour « 10 s ».
- Accent rausch multiplie sur chaque impaye.

### Parcours emotionnel
Pic corrige (sur le pct%). Fin existe (action + feed). Milieu legerement surcharge.

### Progres reels vs 24/40
- Le heros repond enfin (pct% + verdict + barre).
- Sparkline non decoratif, baseline zero, complete le verdict.
- Impayes actionnables (liste de personnes, retard nomme, CTA).
- Deux mensonges d'etat morts.
- Shell fini (etat actif triple, 44px, focus, deconnexion de-hierarchisee).
- Tokens label/body, heading line-height 1.15.

### CORRIGE apres cette re-critique (commit 915981c)
- P1 param mort /paiements?unit -> ?lease.
- P1-bis accent rausch : plein reserve au plus urgent, autres sobres.
- P2 verdict remonte sous le pourcentage.
- P2-bis tri par retard decroissant.
- P3 cas expectedRent === 0 : « Aucun loyer attendu » au lieu de 0 %.

### Reste (non bloquant)
- Densite de commentaires (pas un defaut de design).
- aria-live sur toute la liste du feed (re-lecture possible).
- Sparkline masque < 2 mois d'historique sans micro-etat explicatif (P3).
- Double invalidation summary (sans consequence, React Query dedoublonne).

### Verdict
24 -> ~34 apres refontes, ~37 apres corrections de re-critique. Le prochain palier est soustraire/hierarchiser, pas ajouter.
