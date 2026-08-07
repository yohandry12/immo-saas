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

// Inscription locataire : téléphone + mot de passe, sans organisation.
// Le compte naît « orphelin » : c'est le PROPRIÉTAIRE qui le rattache
// ensuite au bail (sécurité — connaître un numéro ne prouve rien).
export default function RegisterLocatairePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    phone: "",
    firstName: "",
    lastName: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const d = await authService.registerTenant(form);
      setSession({ token: d.token, refreshToken: d.refreshToken });
      router.push("/locataire");
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-24 p-16">
      <h1 className="text-heading-sm font-bold text-rausch">Immo</h1>
      <Card className="w-full max-w-[400px] p-24">
        <h2 className="text-subheading font-semibold text-hof mb-4">
          Compte locataire
        </h2>
        <p className="text-[14px] text-foggy mb-24">
          Utilisez le numéro de téléphone donné à votre propriétaire : c&apos;est
          lui qui confirmera le rattachement à votre bail.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-16">
          <Input
            label="Téléphone"
            type="tel"
            autoComplete="tel"
            placeholder="699 00 00 00"
            value={form.phone}
            onChange={set("phone")}
            required
          />
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
            label="Mot de passe"
            type="password"
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            value={form.password}
            onChange={set("password")}
            required
          />
          {error && <p className="text-[13px] text-rausch-600">{error}</p>}
          <Button variant="accent" type="submit" disabled={busy}>
            {busy ? "Création…" : "Créer mon compte"}
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
