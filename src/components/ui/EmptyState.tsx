import type { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon, title, description, actionLabel, onAction, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center py-14 md:py-16 px-6 bg-surface-1/60 border border-dashed border-surface-4 rounded-3xl ${className}`}>
      <div className="w-14 h-14 mb-4 rounded-2xl bg-brand-500/10 text-brand-400 flex items-center justify-center [&>svg]:w-7 [&>svg]:h-7">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      {description && <p className="text-text-muted text-sm mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" className="mt-5" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
