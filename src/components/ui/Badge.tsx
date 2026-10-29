import type { ReactNode } from "react";

type BadgeVariant = "brand" | "success" | "danger" | "warning" | "info" | "neutral";

const styles: Record<BadgeVariant, string> = {
  brand: "bg-brand-500/10 text-brand-400 border-brand-500/20",
  success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  danger: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  info: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  neutral: "bg-surface-3 text-text-secondary border-surface-4",
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = "neutral", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${styles[variant]} ${className}`}>
      {children}
    </span>
  );
}
