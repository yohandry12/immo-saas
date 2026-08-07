"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { setSession } from "@/lib/session";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

// Inscription propriétaire : compte + « portefeuille » (organisation)
// créés d'un seul geste — miroir du POST /auth/register.
export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    orgName: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await authService.register(form);
      setSession({
        token: d.token,
        refreshToken: d.refreshToken,
        orgId: d.org!.id,
      });
      router.push("/paiement-direct");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-24 p-16">
      <h1 className="text-heading-sm font-bold text-rausch">Immo</h1>
      <Card className="w-full max-w-[440px] p-24">
        <h2 className="text-subheading font-semibold text-hof mb-4">
          Créer mon compte
        </h2>
        <p className="text-[14px] text-foggy mb-24">
          Votre portefeuille d&apos;immeubles, géré depuis n&apos;importe où.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-16">
          <div className="grid grid-cols-2 gap-12">
            <Input
              label="Prénom"
              value={form.firstName}
              onChange={set("firstName")}
              required
            />
            <Input
              label="Nom"
              value={form.lastName}
              onChange={set("lastName")}
              required
            />
          </div>
          <Input
            label="Email"
            type="email"
            placeholder="vous@exemple.cm"
            value={form.email}
            onChange={set("email")}
            required
          />
          <Input
            label="Mot de passe"
            type="password"
            placeholder="8 caractères minimum"
            minLength={8}
            value={form.password}
            onChange={set("password")}
            required
          />
          <Input
            label="Nom du portefeuille"
            placeholder="Ex. : Immeubles Essomba"
            value={form.orgName}
            onChange={set("orgName")}
            required
          />
          {error && <p className="text-[13px] text-rausch-600">{error}</p>}
          <Button variant="accent" type="submit" disabled={busy}>
            {busy ? "Création…" : "Créer mon portefeuille"}
          </Button>
        </form>
      </Card>
      <p className="text-[14px] text-foggy">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-hof hover:underline">
          Me connecter
        </Link>
      </p>
    </main>
  );
}
