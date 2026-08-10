"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { clearSession, getSession, signalLogout } from "@/lib/session";
import { goToLogin } from "@/lib/navigation";
import { authService } from "@/services/auth.service";
import { IconChevronDown, IconLogout } from "./icons";

// Initiales pour la pastille d'identité : « Immo Résidences » → « IR ».
// Pas d'image à charger (léger pour la 3G), et une marque nette qui
// donne le ton « premium » sans dépendance.
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Rôle affiché en clair : le back renvoie un enum, l'utilisateur lit un mot.
const roleLabel: Record<string, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Gestionnaire",
};

export function Topbar() {
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: authService.me,
  });

  const orgId = getSession()?.orgId;
  const org = data?.orgs?.find((o) => o.id === orgId) ?? data?.orgs?.[0];
  const user = data?.user;

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Le menu se ferme au clic dehors et à Échap : comportement attendu
  // d'un menu, sinon il « colle » ouvert et cache le contenu dessous.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function logout() {
    try {
      await authService.logout();
    } catch {
      // Le serveur est injoignable : la session locale meurt quand même.
    }
    clearSession();
    signalLogout(); // prévient les autres onglets
    goToLogin();
  }

  const orgName = org?.name ?? "…";
  const userName = user ? `${user.firstName} ${user.lastName}` : "";

  return (
    <header className="flex h-[64px] items-center justify-between gap-16 border-b border-bebe bg-white px-16 sm:px-24">
      {/* Zone identité : la pastille aux initiales de l'org ancre la
          marque à gauche ; nom de l'org en titre, rôle en sous-ligne. */}
      <div className="flex min-w-0 items-center gap-12">
        <span
          aria-hidden="true"
          className="flex h-36 w-36 shrink-0 items-center justify-center rounded-lg bg-rausch/10 text-label font-bold tracking-tight text-rausch"
        >
          {initials(orgName)}
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-ui font-semibold text-hof">{orgName}</p>
          {org?.role && (
            <p className="truncate text-caption text-foggy">
              {roleLabel[org.role] ?? org.role}
            </p>
          )}
        </div>
      </div>

      {/* Cluster de droite : menu utilisateur. La Déconnexion, action la
          moins fréquente du produit, vit DANS ce menu — plus jamais un
          bouton nu qui vole le contraste à la barre entière. */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Menu du compte"
          className="flex items-center gap-8 rounded-lg py-4 pl-4 pr-8 outline-none transition-colors hover:bg-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hof"
        >
          <span
            aria-hidden="true"
            className="flex h-32 w-32 items-center justify-center rounded-full bg-hof text-caption font-semibold text-white"
          >
            {user ? initials(userName) : "·"}
          </span>
          {userName && (
            <span className="hidden text-label font-medium text-hof sm:inline">
              {user!.firstName}
            </span>
          )}
          <IconChevronDown
            width={16}
            height={16}
            className={`text-foggy transition-transform duration-150 motion-reduce:transition-none ${
              menuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {menuOpen && (
          <div
            role="menu"
            aria-label="Compte"
            className="absolute right-0 top-full z-50 mt-8 w-[240px] rounded-xl border border-bebe bg-white py-8 shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
          >
            {/* En-tête du menu : qui est connecté, sans ambiguïté. */}
            <div className="border-b border-bebe px-16 pb-12 pt-4">
              <p className="truncate text-body font-medium text-hof">
                {userName || "Compte"}
              </p>
              {user?.email && (
                <p className="truncate text-caption text-foggy">{user.email}</p>
              )}
            </div>
            <button
              role="menuitem"
              onClick={logout}
              className="flex w-full items-center gap-12 px-16 py-12 text-left text-body font-medium text-hof outline-none transition-colors hover:bg-faint focus-visible:bg-faint focus-visible:outline-none"
            >
              <IconLogout width={18} height={18} className="text-foggy" />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
