"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { setAccessToken, setSession } from "@/lib/session";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      // « @ » = email (propriétaire) ; sinon téléphone (locataire).
      const id = identifier.trim();
      const d = await authService.login(
        id.includes("@")
          ? { email: id, password }
          : { phone: id, password },
      );
      // Un locataire n'a aucune org : session sans orgId, espace dédié.
      const orgId = d.orgs?.[0]?.id ?? d.org?.id;
      setAccessToken(d.token); // en mémoire, jamais sur disque
      setSession({ orgId });
      router.push(orgId ? "/dashboard" : "/locataire");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-24 p-16">
      <h1 className="text-heading-sm font-bold text-rausch">Immo</h1>
      <Card className="w-full max-w-[400px] p-24">
        <h2 className="text-subheading font-semibold text-hof mb-4">
          Connexion
        </h2>
        <p className="text-[14px] text-foggy mb-24">
          Retrouvez vos immeubles, où que vous soyez.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-16">
          <Input
            label="Email ou téléphone"
            type="text"
            autoComplete="username"
            placeholder="vous@exemple.cm ou 699 00 00 00"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <Input
            label="Mot de passe"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-[13px] text-rausch-600">{error}</p>}
          <Button variant="accent" type="submit" disabled={busy}>
            {busy ? "Connexion…" : "Me connecter"}
          </Button>
        </form>
      </Card>
      <p className="text-[14px] text-foggy">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-medium text-hof hover:underline">
          Créer mon portefeuille
        </Link>{" "}
        ·{" "}
        <Link
          href="/register/locataire"
          className="font-medium text-hof hover:underline"
        >
          Je suis locataire
        </Link>
      </p>
    </main>
  );
}
