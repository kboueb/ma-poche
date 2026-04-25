import { type InputHTMLAttributes, forwardRef } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</label>}
      <div className="relative">
        {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted">{icon}</div>}
        <input
          ref={ref}
          className={twMerge(clsx(
            "w-full bg-surface-2 border border-surface-4 rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted outline-none transition-colors",
            "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30",
            icon && "pl-10",
            error && "border-rose-500 focus:border-rose-500 focus:ring-rose-500/30",
            className,
          ))}
          {...props}
        />
      </div>
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  )
);
Input.displayName = "Input";
