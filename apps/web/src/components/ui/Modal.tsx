"use client";
import { useEffect } from "react";

// Modale accessible minimum viable : overlay sombre, carte blanche 14px,
// Échap + clic-overlay pour fermer. L'ombre overlay est la SEULE grosse
// ombre du système (DESIGN.md : élévation réservée aux surfaces flottantes).
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-16"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[480px] rounded-xl bg-white p-24 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-16">
          <h2 className="text-subheading font-semibold text-hof">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-32 w-32 items-center justify-center rounded-full bg-faint text-hof hover:bg-bebe"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
