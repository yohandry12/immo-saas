import type { HTMLAttributes } from "react";

// Carte DESIGN.md : blanche, radius 12px, SANS ombre ni bordure —
// la séparation vient du contraste canvas #f7f7f7 / carte #ffffff.
export function Card({
  className = "",
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white rounded-[12px] p-16 ${className}`}
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
