"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSession } from "@/lib/session";
import { useIdleLogout } from "@/lib/useIdleLogout";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";

// Coquille des écrans connectés : garde de session + sidebar + topbar.
// La session vit en localStorage → vérification côté client uniquement
// (un middleware serveur ne la voit pas).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const hasSession = !!getSession();

  useIdleLogout(hasSession);

  useEffect(() => {
    if (!hasSession) router.replace("/login");
  }, [hasSession, router]);

  if (!hasSession) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex-1 p-24">{children}</main>
      </div>
    </div>
  );
}
