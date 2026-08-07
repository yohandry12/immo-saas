# Airbnb — Style Reference
> Quiet white gallery wall with one coral-red bookmark

**Theme:** light

Airbnb operates on a white-canvas, photograph-first vocabulary: nearly every screen is a quiet monochrome frame that lets full-bleed property imagery carry the experience, with a single saturated coral-red accent (Rausch) as the only chromatic punctuation for action. Typography is set in a custom geometric sans (Airbnb Cereal VF) at mostly small, confident sizes — 14px body, 16px UI, 22–28px section titles — with tight negative tracking and generous line-height that keeps dense listing cards readable. The interface is flat, borderless, and rounded: 12–14px radii on cards and controls, pill-shaped circular buttons, and soft layered shadows only for elevated overlays like the search bar. Everything else — cards, list items, links — relies on whitespace and hairlines rather than chrome.

> Adaptation immo-saas : police Inter (substitut libre de Cereal), tokens implémentés dans
> `apps/web/src/app/globals.css` (@theme Tailwind v4). Spacing en px vrais (`p-12` = 12px).

## Tokens — Colors

| Name | Value | Token | Role |
|------|-------|-------|------|
| Rausch | `#ff385c` | `--color-rausch` | Red decorative accent for icons, marks, and small graphic details. Do not promote it to the primary CTA color |
| Rausch 600 | `#e00b41` | `--color-rausch-600` | Pressed and dark-state variant of Rausch for hover/active surfaces of the brand accent |
| Hof | `#222222` | `--color-hof` | Primary text, body copy, headings, icon strokes, and inverse backgrounds — a near-black neutral that anchors the entire achromatic system |
| Foggy | `#6a6a6a` | `--color-foggy` | Secondary text, muted labels, helper copy, disabled icon fills, and subdued metadata beneath card titles |
| Grey 500 | `#c1c1c1` | `--color-grey-500` | Disabled text, placeholder text in inputs, and muted icon strokes where state de-emphasis is required |
| Bebe | `#ebebeb` | `--color-bebe` | Hairline borders, input underlines, dividers between list rows, and subtle separator lines |
| Deco | `#dddddd` | `--color-deco` | Card surface backgrounds for muted containers, skeleton placeholders, and disabled card states |
| Faint | `#f7f7f7` | `--color-faint` | Page canvas background, footer surface, and hover state for interactive surfaces — the soft off-white that sets the page apart from pure white cards |
| White | `#ffffff` | `--color-white` | Elevated card surfaces, input fields, modals, and the primary surface against the off-white canvas |

## Tokens — Typography

**Famille** : Inter (substitut d'Airbnb Cereal VF ; alternatives : Circular, DM Sans).
Weights 400/500/600/700. Feature OpenType `"salt" on`.

| Role | Size | Line Height | Letter Spacing | Token |
|------|------|-------------|----------------|-------|
| caption | 11px | 1.18 | — | `--text-caption` |
| body | 14px | 1.43 | — | (défaut body) |
| ui | 16px | 1.25 | — | `--text-ui` |
| subheading | 20px | 1.2 | -0.18px | `--text-subheading` |
| heading-sm | 22px | 1.18 | -0.44px | `--text-heading-sm` |
| heading | 28px | 1.43 | — | `--text-heading` |

Négative tracking se resserre quand la taille augmente. Corps 14px/400 porte le contenu ;
labels UI 16px/500 ; titres de section 20px/600 et 22px/500 ; titres de page 28px/700.

## Tokens — Spacing & Shapes

**Base unit:** 4px — **Density:** compact
Échelle : 4, 8, 12, 16, 20, 24, 28, 32, 40, 44, 48 (px vrais dans Tailwind : `p-12` = 12px).

### Border Radius

| Element | Value |
|---------|-------|
| cards | 12px |
| badges | 9999px |
| inputs | 8px |
| avatars | 9999px |
| buttons | 9999px (pill) ou 8px (rectangulaires ghost/inverse) |

### Shadows

| Name | Value | Usage |
|------|-------|-------|
| subtle | `0 0 0 1px rgba(0,0,0,.02), 0 2px 6px rgba(0,0,0,.04), 0 4px 8px rgba(0,0,0,.10)` | Barre de recherche, surfaces flottantes légères |
| overlay | `0 8px 28px rgba(0,0,0,.28)` | Modales |
| dropdown | `0 6px 20px rgba(0,0,0,.2)` | Menus |

**Jamais d'ombre sur les cartes** : la séparation vient du contraste canvas #f7f7f7 / carte #ffffff.

### Layout

- Section gap : 48px · Card padding : 12–16px · Element gap : 12px
- Sidebar app : 220px, fond blanc, hairline bebe à droite.

## Surfaces

| Level | Name | Value | Purpose |
|-------|------|-------|---------|
| 0 | Canvas | `#f7f7f7` | Page background |
| 1 | Card | `#ffffff` | Cartes, inputs, surfaces interactives |
| 2 | Muted | `#dddddd` | Skeletons, états désactivés |
| 3 | Inverse | `#222222` | Boutons inverses, overlays haut-contraste |

## Do's and Don'ts

### Do
- Corps 14px/400 hof, line-height 1.43 — la colonne vertébrale.
- Rausch UNIQUEMENT pour : logo, action primordiale de l'écran, moments d'argent clés. Aucun autre rouge.
- Radius 9999px pour pilules/badges/boutons circulaires, 12px cartes, 8px inputs et boutons rectangulaires.
- Titres de section 22px/500 tracking -0.02em.
- Canvas #f7f7f7 + cartes #ffffff : l'élévation se lit par la valeur, pas par l'ombre.

### Don't
- Pas d'autres couleurs d'accent que rausch (tons sémantiques discrets tolérés pour statuts payé/attente/échoué).
- Pas d'ombres sur les cartes. Pas de bordures sur les cartes.
- Pas de corps sous 12px (11px réservé aux badges).
- Pas de gras 700 pour le corps ou les métadonnées — réservé aux titres 28px/21px.
- Pas de rausch en couleur de texte décoratif ni de fond de section.

## Composants implémentés

`apps/web/src/components/ui/` : Button (primary inverse #222 / accent rausch / ghost / danger),
Input, Select, Card, Badge (pilules statuts), Table (hairlines bebe, hover faint), Modal
(ombre overlay, Échap), Skeleton, EmptyState. Shell : Sidebar 220px + Topbar 64px.
