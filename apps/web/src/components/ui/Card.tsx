import type { HTMLAttributes } from "react";

// Carte : blanche, radius 12px, hairline bebe — SANS ombre.
// Le contraste #fff/#f7f7f7 seul (≈2 % de delta) disparaissait sur une
// dalle Android moyenne le soir : la hairline garantit que la carte
// existe dans les conditions réelles des personas. C'est le geste
// Resend/Airbnb : « hairlines rather than chrome ».
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white rounded-[12px] border border-bebe p-16 ${className}`}
      {...props}
    />
  );
}

export function CardTitle({
  className = "",
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={`text-subheading font-semibold text-hof mb-12 ${className}`}
      {...props}
    />
  );
}
