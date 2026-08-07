import type { FeedEvent } from "@/services/types";
import { formatFCFA } from "./format";

// Traduit un événement du feed en phrase française lisible.
// Le payload backend porte déjà ce qu'il faut afficher (unitLabel, amount…).
const METHODS: Record<string, string> = {
  CASH: "espèces",
  MOMO: "MTN MoMo",
  ORANGE_MONEY: "Orange Money",
  BANK: "virement",
};

export function eventLabel(e: FeedEvent): string {
  const p = e.payload as {
    unitLabel?: string;
    amount?: number;
    method?: string;
    tenantName?: string;
    type?: string;
    period?: string;
    category?: string;
    description?: string;
  };
  const unit = p.unitLabel ? ` · ${p.unitLabel}` : "";
  const amount = typeof p.amount === "number" ? ` ${formatFCFA(p.amount)}` : "";
  const method = p.method ? ` (${METHODS[p.method] ?? p.method})` : "";

  switch (e.type) {
    case "PAYMENT_RECORDED":
      return `Paiement enregistré${unit} :${amount}${method}`;
    case "PAYMENT_CONFIRMED":
      return `Paiement reçu${unit} :${amount}${method}`;
    case "PAYMENT_FAILED":
      return `Paiement échoué${unit} :${amount}${method}`;
    case "LEASE_SIGNED":
      return `Bail signé${unit}${p.tenantName ? ` avec ${p.tenantName}` : ""}`;
    case "LEASE_TERMINATED":
      return `Bail terminé${unit}`;
    case "BILL_SENT":
      return `Charges envoyées${p.period ? ` (${p.period})` : ""}${amount}`;
    case "EXPENSE_CREATED":
      return `Dépense déclarée${amount}${p.description ? ` : ${p.description}` : ""}`;
    default:
      return e.type;
  }
}

// « il y a 5 min », « hier », « 12 juil. » — l'échelle glisse avec l'âge.
const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
const shortDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
});

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffS = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffS);
  if (abs < 60) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(diffS / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffS / 3600), "hour");
  if (abs < 7 * 86400) return rtf.format(Math.round(diffS / 86400), "day");
  return shortDate.format(then);
}

// Mois courant au format « AAAA-MM » attendu par l'API.
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
