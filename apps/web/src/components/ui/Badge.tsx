import type { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger";

// Pastilles pleines-rondes (radius 9999) — statuts métier :
// CONFIRMED/actif, PENDING/attente, FAILED/terminé.
const tones: Record<Tone, string> = {
  neutral: "bg-faint text-foggy",
  success: "bg-[#e6f4ea] text-[#1e7e34]",
  warning: "bg-[#fff4e0] text-[#a36200]",
  danger: "bg-[#fdecef] text-rausch-600",
};

export function Badge({
  tone = "neutral",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-12 py-4 text-caption font-semibold ${tones[tone]} ${className}`}
      {...props}
    />
  );
}
