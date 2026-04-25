import { forwardRef, type SelectHTMLAttributes } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ChevronDown } from "lucide-react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</label>}
      <div className="relative">
        <select
          ref={ref}
          className={twMerge(clsx(
            "w-full bg-surface-2 border border-surface-4 rounded-xl px-4 py-2.5 pr-10 text-sm text-text-primary outline-none transition-colors appearance-none",
            "focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30",
            error && "border-rose-500",
            className,
          ))}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
      </div>
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
    </div>
  )
);
Select.displayName = "Select";
