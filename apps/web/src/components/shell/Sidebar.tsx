"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Une seule entrée réellement câblée aujourd'hui (paiement-direct) ;
// les autres apparaissent désactivées — la carte du produit est visible
// dès maintenant, les écrans arrivent en F2.
const items: { label: string; href: string; ready: boolean }[] = [
  { label: "Tableau de bord", href: "/dashboard", ready: false },
  { label: "Immeubles", href: "/immeubles", ready: false },
  { label: "Baux", href: "/baux", ready: false },
  { label: "Paiements", href: "/paiement-direct", ready: true },
  { label: "Charges", href: "/charges", ready: false },
  { label: "Dépenses", href: "/depenses", ready: false },
  { label: "Organisation", href: "/organisation", ready: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-[220px] shrink-0 flex-col gap-4 border-r border-bebe bg-white px-12 py-24">
      <Link
        href="/paiement-direct"
        className="mb-24 px-12 text-heading-sm font-bold text-rausch"
      >
        Immo
      </Link>
      <nav className="flex flex-col gap-4">
        {items.map((item) =>
          item.ready ? (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-12 py-8 text-[14px] font-medium ${
                pathname.startsWith(item.href)
                  ? "bg-faint text-hof"
                  : "text-foggy hover:bg-faint hover:text-hof"
              }`}
            >
              {item.label}
            </Link>
          ) : (
            <span
              key={item.href}
              className="flex items-baseline justify-between rounded-lg px-12 py-8 text-[14px] text-grey-500 cursor-default"
              title="Bientôt disponible"
            >
              {item.label}
              <span className="text-caption font-semibold uppercase">
                bientôt
              </span>
            </span>
          ),
        )}
      </nav>
    </aside>
  );
}
