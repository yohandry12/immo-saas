import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "ghost" | "danger";

// Hiérarchie DESIGN.md : l'action par défaut est l'inverse #222 (« Filled
// Inverse ») ; rausch est réservé à UNE action primordiale par écran.
const styles: Record<Variant, string> = {
  primary:
    "bg-hof text-white hover:bg-black disabled:bg-deco disabled:text-foggy",
  accent:
    "bg-rausch text-white hover:bg-rausch-600 disabled:bg-deco disabled:text-foggy",
  ghost:
    "bg-transparent text-hof border border-hof hover:bg-faint disabled:border-deco disabled:text-grey-500",
  danger:
    "bg-transparent text-rausch-600 border border-rausch-600 hover:bg-rausch/5 disabled:border-deco disabled:text-grey-500",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      // focus-visible : la navigation clavier était invisible (exigence
      // PRODUCT.md). Ring décalé pour rester net sur fond blanc et faint.
      className={`inline-flex items-center justify-center gap-8 rounded-lg px-16 h-40 text-[14px] font-medium outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-hof disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}
