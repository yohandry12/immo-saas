
"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHasSession } from "@/lib/session";
import { useIdleLogout } from "@/lib/useIdleLogout";
import { MobileNav, Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

// Coquille des écrans connectés : garde de session + sidebar + topbar.
// useHasSession est hydration-safe : le serveur rend « pas de session »
// (null), le client corrige après hydratation — jamais de mismatch.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasSession = useHasSession();

  useEffect(() => {
    // false = certitude d'absence ; null = hydratation en cours, on attend.
    if (hasSession === false) router.replace("/login");
  }, [hasSession, router]);

  useIdleLogout(hasSession === true);

  if (!hasSession) return null;

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
