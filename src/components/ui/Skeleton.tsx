import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Bloc de chargement unifié (thème-aware, respecte reduced-motion via CSS). */
export function Skeleton({ className }: { className?: string }) {
  return <div className={twMerge(clsx("bg-surface-1 border border-surface-3 rounded-2xl animate-pulse", className))} />;
}

/** Grille de cartes stats */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-[120px]" />
      ))}
    </div>
  );
}

/** Liste de lignes (transactions, factures…) */
export function SkeletonList({ rows = 6, rowClass = "h-14 rounded-xl" }: { rows?: number; rowClass?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={rowClass} />
      ))}
    </div>
  );
}

/** Grille de cartes (budgets, projets, objectifs…) */
export function SkeletonCards({ count = 4, cardClass = "h-40" }: { count?: number; cardClass?: string }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cardClass} />
      ))}
    </div>
  );
}
