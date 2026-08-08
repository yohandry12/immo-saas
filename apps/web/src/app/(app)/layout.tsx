"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { restoreSession } from "@/lib/api";
import {
  clearSession,
  onLogoutSignal,
  signalLogout,
  useHasSession,
} from "@/lib/session";
import { useIdleLogout } from "@/lib/useIdleLogout";
import { goToLogin } from "@/lib/navigation";
import { MobileNav, Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { Skeleton } from "@/components/ui/Skeleton";

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
        // Le cookie est mort : session finie, retour au login. On
        // prévient les autres onglets, sinon un onglet resté ouvert
        // continuerait d'afficher ses données jusqu'à sa propre
        // expiration d'access.
        signalLogout();
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

  // hasSession null (hydratation en cours) ou false (redirection déjà
  // déclenchée) : ne rien afficher est correct. hasSession true mais
  // pas encore ready : le refresh silencieux est en cours (et peut
  // prendre jusqu'à 15 s sur un réseau lent) — il faut un indicateur
  // visible, sinon l'écran reste blanc sans explication.
  if (hasSession === null || hasSession === false) return null;
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-8">
          <Skeleton className="h-32 w-32 rounded-full" />
          <p className="text-body text-foggy">Chargement…</p>
        </div>
      </div>
    );
  }

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
