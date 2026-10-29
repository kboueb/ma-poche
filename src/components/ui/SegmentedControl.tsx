import { useId } from "react";
import { motion } from "framer-motion";

interface Option<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  size?: "sm" | "md";
}

/** Sélecteur segmenté (tabs Perso/Missions, Semaine/Mois…) avec indicateur animé. */
export function SegmentedControl<T extends string>({ options, value, onChange, size = "md" }: SegmentedControlProps<T>) {
  const pad = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";
  const layoutId = useId();
  return (
    <div className="grid grid-flow-col auto-cols-fr gap-1 p-1 bg-surface-1 border border-surface-3 rounded-xl shrink-0">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`relative flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors ${pad} ${
              active ? "text-text-primary" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 bg-surface-3 rounded-lg"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
