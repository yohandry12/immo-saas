# Product

## Register

product

## Users
- **Propriétaire diaspora** (persona principal) : Camerounais vivant à l'étranger (France, USA…), possède 1 à 3 immeubles à Douala/Yaoundé. Consulte le soir sur mobile ou desktop. Job : savoir que ses loyers tombent, que ses immeubles sont entretenus, sans dépendre d'appels téléphoniques ni faire confiance aveugle.
- **Gestionnaire local** : mandataire sur place, smartphone Android milieu de gamme, réseau instable. Job : enregistrer paiements cash/MoMo, déclarer dépenses avec photos, envoyer les charges.
- **Locataire** : paie son loyer par MTN MoMo / Orange Money depuis son téléphone, consulte son solde et son historique.

## Product Purpose
SaaS de gestion locative pour le Cameroun. Rend visible à distance ce qui se passait dans l'opacité : paiements (cash, Mobile Money via NotchPay), baux avec avances/cautions à la camerounaise, charges communes réparties, dépenses photographiées, feed d'activité temps réel. Succès = le propriétaire diaspora ouvre le dashboard et sait en 10 secondes si le mois est bon. FCFA entiers partout, jamais de décimales.

## Brand Personality
Confiance, clarté, proximité. L'interface d'un carnet de comptes tenu proprement, pas d'un jouet fintech. Le ton parle français simple, sans jargon technique ni anglicismes inutiles. L'argent est montré avec sobriété : chiffres nets, statuts francs (payé / en attente / échoué).

## Anti-references
- Dashboards SaaS génériques : gros chiffres gradients, cartes-métriques clonées, graphiques décoratifs sans question à laquelle répondre.
- Fintech « crypto-flashy » : dark mode par défaut, néons, animations tape-à-l'œil. L'argent du loyer est sérieux.
- Formulaires administratifs denses type banque : l'app doit rester plus simple qu'un cahier.

## Design Principles
1. **Le mois en 10 secondes** : chaque écran répond d'abord à « où en suis-je ? » — encaissé vs attendu avant tout détail.
2. **La preuve plutôt que la promesse** : montrer l'événement (paiement reçu, dépense photographiée, quittance), pas des scores abstraits.
3. **Un seul accent** : rausch réservé à l'action primordiale et aux moments d'argent qui comptent ; tout le reste en monochrome calme (DESIGN.md).
4. **Conçu pour la 3G** : léger, peu de requêtes, états de chargement honnêtes (skeletons), rien qui casse si le réseau lâche.
5. **Lisible par un non-gestionnaire** : vocabulaire du quotidien (« appartement », « avance », « caution »), montants FCFA formatés, dates en français.

## Accessibility & Inclusion
WCAG AA : contrastes ≥ 4.5:1 pour le corps (hof #222 sur blanc/faint passe ; foggy #6a6a6a réservé aux textes secondaires ≥ 14px sur blanc), cibles tactiles ≥ 44px sur mobile, `prefers-reduced-motion` respecté sur toute animation, formulaires labellisés, navigation clavier sur les modales.
