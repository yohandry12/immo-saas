"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import {
  IconBanknote,
  IconBuilding,
  IconDroplet,
  IconFileText,
  IconGauge,
  IconUserCircle,
  IconUsers,
  IconWrench,
} from "./icons";

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  // « gestion » = le métier quotidien ; « compte » = l'administratif.
  // Deux natures, deux blocs : l'œil ne relit pas 8 items d'un coup.
  group: "gestion" | "compte";
};

export const navItems: NavItem[] = [
  { label: "Tableau de bord", href: "/dashboard", icon: IconGauge, group: "gestion" },
  { label: "Immeubles", href: "/immeubles", icon: IconBuilding, group: "gestion" },
  { label: "Baux", href: "/baux", icon: IconFileText, group: "gestion" },
  { label: "Paiements", href: "/paiements", icon: IconBanknote, group: "gestion" },
  { label: "Charges", href: "/charges", icon: IconDroplet, group: "gestion" },
  { label: "Dépenses", href: "/depenses", icon: IconWrench, group: "gestion" },
  { label: "Organisation", href: "/organisation", icon: IconUsers, group: "compte" },
  { label: "Mon compte", href: "/compte", icon: IconUserCircle, group: "compte" },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      // État actif à TROIS signaux (fond + graisse/couleur + barre) :
      // un seul bg-faint sur blanc était pratiquement invisible.
      className={`relative flex min-h-40 items-center gap-12 rounded-lg px-12 py-8 text-body outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-hof ${
        active
          ? "bg-faint font-medium text-hof"
          : "text-foggy hover:bg-faint hover:text-hof"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-16 w-[3px] -translate-y-1/2 rounded-full bg-hof"
        />
      )}
      <Icon className="shrink-0" />
      {item.label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const gestion = navItems.filter((i) => i.group === "gestion");
  const compte = navItems.filter((i) => i.group === "compte");

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col border-r border-bebe bg-white px-12 py-24">
      <Link
        href="/dashboard"
        className="mb-24 rounded-lg px-12 text-heading-sm font-bold text-rausch outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hof"
      >
        Immo
      </Link>
      <nav className="flex flex-col gap-4" aria-label="Navigation principale">
        {gestion.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
          />
        ))}
        {/* Le trait sépare le métier (les immeubles, l'argent) de
            l'administratif (l'équipe, le compte). */}
        <hr className="my-12 border-bebe" aria-hidden="true" />
        {compte.map((item) => (
          <NavLink
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </nav>
    </aside>
  );
}

// Nav mobile : la sidebar est cachée sous md — sans cette rangée de
// pilules, un téléphone n'aurait AUCUNE navigation.
export function MobileNav() {
  const pathname = usePathname();

  return (
    // Le dégradé blanc sur le bord droit signale que la rangée déborde :
    // sans lui, « Organisation » et « Mon compte » n'existaient pas pour
    // qui ne pense pas à scroller.
    <div className="relative border-b border-bebe bg-white md:hidden">
      <nav
        aria-label="Navigation principale"
        className="flex gap-8 overflow-x-auto px-16 py-8 [scrollbar-width:none]"
      >
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              // min-h-44 : cible tactile ≥ 44px (PRODUCT.md), la règle
              // était violée sur l'unique navigation mobile.
              className={`flex min-h-44 items-center whitespace-nowrap rounded-full px-16 text-body font-medium outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hof ${
                active ? "bg-hof text-white" : "bg-faint text-foggy"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-white to-transparent"
      />
    </div>
  );
}
