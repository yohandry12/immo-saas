import { monthLabel } from "@/lib/format";

type Point = { period: string; collectedRent: number };

// Sparkline SVG pur (aucune dépendance) : la tendance des encaissements
// sur quelques mois, sous le chiffre héros. Le dernier point est mis en
// évidence — c'est le mois affiché. Aire dégradée douce, courbe hof.
export function Sparkline({
  data,
  height = 48,
}: {
  data: Point[];
  height?: number;
}) {
  if (data.length < 2) return null;

  const W = 100; // viewBox en pourcentage : le SVG s'étire en largeur
  const H = height;
  const pad = 4; // marge verticale pour que la courbe ne touche pas les bords
  const max = Math.max(...data.map((d) => d.collectedRent), 1);

  const x = (i: number) => (i / (data.length - 1)) * W;
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);

  const line = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(d.collectedRent).toFixed(2)}`)
    .join(" ");
  // Aire = la ligne refermée jusqu'en bas.
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;

  const last = data[data.length - 1];

  return (
    <figure className="mt-24">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-12 w-full sm:h-16"
        role="img"
        aria-label={`Encaissements des ${data.length} derniers mois, de ${monthLabel(data[0].period)} à ${monthLabel(last.period)}`}
      >
        <defs>
          <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-hof)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--color-hof)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#spark-fill)" />
        <path
          d={line}
          fill="none"
          stroke="var(--color-hof)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {/* Le mois courant : un point plein qui ancre l'œil sur « où on
            en est aujourd'hui ». */}
        <circle
          cx={x(data.length - 1)}
          cy={y(last.collectedRent)}
          r="2.5"
          fill="var(--color-hof)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* Étiquettes des mois : le premier et le dernier suffisent, le
          reste alourdirait. */}
      <figcaption className="mt-8 flex justify-between text-caption text-foggy">
        <span>{monthLabel(data[0].period)}</span>
        <span>{monthLabel(last.period)}</span>
      </figcaption>
    </figure>
  );
}
