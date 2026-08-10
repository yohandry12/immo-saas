import type { ReactNode } from "react";

// Carte de suivi : INFORME, n'agit pas — donc jamais d'accent corail.
// Structure inspirée d'une réf (gros chiffre, libellé discret, détail),
// rendue en thème blanc DESIGN.md : hairline, pas d'ombre, pas de flou.
export function StatCard({
  label,
  icon,
  value,
  detail,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-8 rounded-[12px] border border-bebe bg-white p-16">
      <div className="flex items-center gap-8">
        {/* Pastille ronde neutre : même langage rond que les initiales de
            la Topbar, jamais corail (réservé à l'action). */}
        <span
          aria-hidden="true"
          className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full bg-faint text-foggy"
        >
          {icon}
        </span>
        <span className="text-label text-foggy">{label}</span>
      </div>
      <p className="text-ui font-semibold tabular-nums leading-tight text-hof">
        {value}
      </p>
      {detail && <div className="text-label text-foggy">{detail}</div>}
    </div>
  );
}
