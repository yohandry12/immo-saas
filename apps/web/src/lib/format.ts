// Formatage FCFA centralisé : entiers, séparateur d'espace, jamais de
// décimales (le franc CFA n'en a pas). « 150000 » → « 150 000 FCFA ».
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

export function formatFCFA(amount: number): string {
  return `${nf.format(amount)} FCFA`;
}

// Date courte lisible : « 7 août 2026 ».
const df = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return df.format(typeof d === "string" ? new Date(d) : d);
}

// Période "AAAA-MM" → « août 2026 ». Pour titrer le mois affiché.
const mf = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });

export function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return mf.format(new Date(y, m - 1, 1));
}
