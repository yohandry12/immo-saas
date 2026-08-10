import { monthLabel } from "@/lib/format";

type Point = { period: string; collectedRent: number };

// Mini-barres 6 mois pour la carte « Encaissé » : la forme des
// encaissements récents, dernière barre (mois courant) en évidence.
// SVG pur, aucune dépendance — léger pour la 3G.
export function MiniBars({ data }: { data: Point[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.collectedRent), 1);
  const last = data[data.length - 1];
  return (
    <div
      role="img"
      aria-label={`Encaissements des ${data.length} derniers mois, de ${monthLabel(
        data[0].period,
      )} à ${monthLabel(last.period)}`}
      className="flex h-24 items-end gap-4"
    >
      {data.map((d, i) => {
        const h = Math.round((d.collectedRent / max) * 100);
        const current = i === data.length - 1;
        return (
          <span
            key={d.period}
            className={`w-full rounded-sm ${current ? "bg-hof" : "bg-bebe"}`}
            style={{ height: `${Math.max(h, 6)}%` }}
          />
        );
      })}
    </div>
  );
}
