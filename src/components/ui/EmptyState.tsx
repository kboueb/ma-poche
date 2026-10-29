import type { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="text-center py-16 md:py-20 bg-surface-1 border-2 border-dashed border-surface-3 rounded-3xl px-6">
      <div className="text-surface-3 mx-auto mb-4 flex justify-center [&>svg]:w-12 [&>svg]:h-12">
        {icon}
      </div>
      <p className="font-semibold">{title}</p>
      {description && <p className="text-text-muted text-sm mt-1 max-w-sm mx-auto">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="secondary" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
