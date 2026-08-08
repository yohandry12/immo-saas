import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";

// Table sobre : en-têtes 13px foggy, lignes séparées par hairline bebe,
// hover faint. Pas de bordures verticales, pas de zébrures.
export function Table({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-left text-body ${className}`} {...props} />
    </div>
  );
}

export function Th({
  className = "",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={`py-8 px-12 text-label font-medium text-foggy border-b border-bebe ${className}`}
      {...props}
    />
  );
}

export function Td({
  className = "",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={`py-12 px-12 border-b border-bebe text-hof ${className}`}
      {...props}
    />
  );
}

export function Tr({
  className = "",
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-faint ${className}`} {...props} />;
}
