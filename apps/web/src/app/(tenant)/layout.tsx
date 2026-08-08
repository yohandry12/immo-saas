"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { restoreSession } from "@/lib/api";
import { clearSession, onLogoutSignal, signalLogout, useHasSession } from "@/lib/session";
import { useIdleLogout } from "@/lib/useIdleLogout";
import { goToLogin } from "@/lib/navigation";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";

// Coquille de l'espace locataire : garde de session, SANS le shell
// propriétaire (sidebar, topbar org) — un locataire n'a pas d'org,
// donc aucun appel scoped X-Org-Id ne part de ces écrans.
export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const hasSession = useHasSession();
  // Même raison que le shell propriétaire : l'access est en mémoire et
  // doit être régénéré par le cookie avant de rendre quoi que ce soit.
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (hasSession === false) {
      router.replace("/login");
      return;
    }
    if (hasSession !== true) return;

    let cancelled = false;
    restoreSession().then((ok) => {
      if (cancelled) return;
      if (!ok) {
        // Le cookie est mort : session finie. On prévient les autres
        // onglets, sinon l'un d'eux resterait affiché avec ses données
        // jusqu'à sa propre expiration d'access.
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

  useEffect(() => {
    return onLogoutSignal(() => {
      clearSession();
      goToLogin();
    });
  }, []);

  useIdleLogout(ready);

  async function logout() {
    try {
      await authService.logout();
    } catch {
      // Le serveur est injoignable : la session locale meurt quand même.
    }
    clearSession();
    signalLogout();
    goToLogin();
  }

  // hasSession null (hydratation en cours) ou false (redirection déjà
  // déclenchée) : ne rien afficher est correct. hasSession true mais
  // pas encore ready : le refresh silencieux est en cours — il faut un
  // indicateur visible, sinon l'écran reste blanc sans explication.
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
    <div className="flex min-h-screen flex-col">
      <header className="flex h-[64px] items-center justify-between border-b border-bebe bg-white px-24">
        <span className="text-ui font-semibold text-rausch">Immo</span>
        <Button variant="ghost" onClick={logout} className="h-32 px-12">
          Déconnexion
        </Button>
      </header>
      <main className="flex-1 p-16 md:p-24">{children}</main>
    </div>
  );
}
