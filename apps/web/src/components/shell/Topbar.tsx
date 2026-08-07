"use client";
import { useQuery } from "@tanstack/react-query";
import { clearSession, getSession, signalLogout } from "@/lib/session";
import { goToLogin } from "@/lib/navigation";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";

export function Topbar() {
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: authService.me,
  });

  const orgId = getSession()?.orgId;
  const org = data?.orgs?.find((o) => o.id === orgId) ?? data?.orgs?.[0];

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

  return (
    <header className="flex h-[64px] items-center justify-between border-b border-bebe bg-white px-24">
      <div className="flex items-baseline gap-12">
        <span className="text-ui font-medium text-hof">
          {org?.name ?? "…"}
        </span>
        {data?.user && (
          <span className="text-[13px] text-foggy">
            {data.user.firstName} {data.user.lastName}
          </span>
        )}
      </div>
      <Button variant="ghost" onClick={logout} className="h-32 px-12">
        Déconnexion
      </Button>
    </header>
  );
}
