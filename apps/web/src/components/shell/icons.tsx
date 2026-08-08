import type { SVGProps } from "react";

// Icônes de navigation : SVG inline (tracés Lucide, ISC) plutôt qu'une
// dépendance — huit icônes ne justifient pas un paquet, et le bundle
// reste léger pour la 3G. Trait 1.75, linecap/join arrondis :
// des glyphes plus fins et plus nets que la version 1.5, pour la
// finition « premium » demandée. currentColor : l'icône hérite du gris
// du libellé et fonce avec lui à l'état actif.
function base(props: SVGProps<SVGSVGElement>) {
  return {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

/** Tableau de bord — la maison : « chez moi, ma vue d'ensemble ». */
export function IconGauge(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

/** Immeubles — deux tours, plus urbain qu'un simple bâtiment. */
export function IconBuilding(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M4 21V5a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v16" />
      <path d="M12 9h7a1 1 0 0 1 1 1v11" />
      <path d="M7 8h1M7 12h1M7 16h1M16 13h1M16 17h1" />
      <path d="M3 21h18" />
    </svg>
  );
}

/** Baux — le document signé. */
export function IconFileText(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" />
      <path d="M14 2v5h5" />
      <path d="M8 13h8M8 17h5" />
    </svg>
  );
}

/** Paiements — carte, plus « argent numérique » qu'un billet. */
export function IconBanknote(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <rect width="20" height="14" x="2" y="5" rx="2.5" />
      <path d="M2 10h20" />
      <path d="M6 15h4" />
    </svg>
  );
}

/** Charges — la goutte : l'eau, la plus parlante des charges communes. */
export function IconDroplet(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M12 3.1 6.8 8.7a7 7 0 1 0 10.4 0z" />
    </svg>
  );
}

/** Dépenses — l'outil : réparations, entretien. */
export function IconWrench(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 5.5a4 4 0 0 0-5 5L4 16l4 4 5.5-5.5a4 4 0 0 0 5-5l-2.8 2.8-2.2-2.2z" />
    </svg>
  );
}

/** Organisation — l'équipe. */
export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3.25" />
      <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
      <path d="M16 5.3a3.25 3.25 0 0 1 0 6.1" />
      <path d="M17.5 14.2A5.5 5.5 0 0 1 20.5 20" />
    </svg>
  );
}

/** Mon compte — la personne. */
export function IconUserCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="10" r="3" />
      <path d="M6.5 19.2a6 6 0 0 1 11 0" />
    </svg>
  );
}

/** Chevron de collapse — pointe vers l'intérieur (replier) par défaut. */
export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base(props)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
