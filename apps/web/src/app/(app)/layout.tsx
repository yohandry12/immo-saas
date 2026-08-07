"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { restoreSession } from "@/lib/api";
import { clearSession, onLogoutSignal, useHasSession } from "@/lib/session";
import { useIdleLogout } from "@/lib/useIdleLogout";
import { goToLogin } from "@/lib/navigation";
import { MobileNav, Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

// Coquille des écrans connectés : garde de session + sidebar + topbar.
// useHasSession est hydration-safe : le serveur rend « pas de session »
// (null), le client corrige après hydratation — jamais de mismatch.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasSession = useHasSession();
  // L'access vit en mémoire : au rechargement il est perdu, et seul le
  // cookie httpOnly peut le régénérer. Tant que ce refresh silencieux
  // n'a pas répondu, on ne rend rien — sinon chaque écran tirerait des
  // requêtes sans jeton, qui échoueraient toutes en 401.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // false = certitude d'absence ; null = hydratation en cours, on attend.
    if (hasSession === false) {
      router.replace("/login");
      return;
    }
    if (hasSession !== true) return;

    let cancelled = false;
    restoreSession().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        // Le cookie est mort : session finie, retour au login.
        clearSession();
        router.replace("/login");
        return;
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasSession, router]);

  // Déconnexion déclenchée dans un AUTRE onglet : on suit immédiatement,
  // sans attendre l'expiration de l'access (15 min).
  useEffect(() => {
    return onLogoutSignal(() => {
      clearSession();
      goToLogin();
    });
  }, []);

  useIdleLogout(ready);

  if (!hasSession || !ready) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <MobileNav />
        <main className="flex-1 p-16 md:p-24">{children}</main>
      </div>
    </div>
  );
}
