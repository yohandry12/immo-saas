"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSession } from "@/lib/session";

// Racine : simple aiguillage. Session → app ; sinon → connexion.
// (La session vit en localStorage : l'aiguillage ne peut être que client.)
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getSession() ? "/dashboard" : "/login");
  }, [router]);

  return null;
}
