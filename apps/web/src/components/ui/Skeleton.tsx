// Placeholder de chargement : surface deco (#ddd) qui pulse.
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-deco ${className}`}
      aria-hidden="true"
    />
  );
}

// État vide : message centré, sobre.
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-8 py-48 text-center">
      <p className="text-ui font-medium text-hof">{title}</p>
      {hint && <p className="text-[14px] text-foggy max-w-[360px]">{hint}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}
