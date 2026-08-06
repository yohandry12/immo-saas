"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage } from "@/lib/api";
import { setSession } from "@/lib/session";
import { authService } from "@/services/auth.service";

// Page fonctionnelle, aucun design : le design viendra plus tard.
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const d = await authService.login({ email, password });
      setSession({
        token: d.token,
        refreshToken: d.refreshToken,
        orgId: d.orgs?.[0]?.id ?? d.org!.id,
      });
      router.push("/paiement-direct");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const input = {
    display: "block",
    width: "100%",
    padding: 8,
    marginBottom: 8,
  } as const;

  return (
    <main style={{ padding: 24, maxWidth: 360, margin: "0 auto" }}>
      <h1>Connexion</h1>
      <form onSubmit={submit}>
        <input
          style={input}
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          style={input}
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={{ color: "crimson" }}>{error}</p>}
        <button type="submit" style={{ padding: 8 }}>
          Entrer
        </button>
      </form>
    </main>
  );
}
