interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}

const MARK_SIZE = { sm: "w-7 h-7", md: "w-9 h-9", lg: "w-14 h-14" } as const;
const TEXT_SIZE = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" } as const;

// Symbole « Jeton m » : une pièce dont deux fentes ouvertes par le bas dessinent un m.
// Masters et règles d'usage : design/brand/
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="32 32 192 192" aria-hidden="true" className={`text-[#059669] dark:text-brand-500 ${className}`}>
      <path
        fill="currentColor"
        d="M88 215.27 A96 96 0 1 1 168 215.27 V124 A12 12 0 0 0 144 124 V222.66 A96 96 0 0 1 112 222.66 V124 A12 12 0 0 0 88 124 Z"
      />
    </svg>
  );
}

export function Logo({ className = "", showTagline = false, size = "md" }: LogoProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className={`flex items-center ${size === "lg" ? "gap-3" : "gap-2"}`}>
        <LogoMark className={`${MARK_SIZE[size]} shrink-0`} />
        <h1 className={`${TEXT_SIZE[size]} font-bold flex tracking-tight items-baseline leading-none`}>
          <span className="text-[#b45309] dark:text-[#f59e0b]">ma</span>
          <span className="text-text-primary">Poche</span>
        </h1>
      </div>
      {showTagline && (
        <p className="text-[10px] text-text-muted uppercase tracking-[0.3em] font-bold mt-1">
          Gérez. Suivez. Économisez.
        </p>
      )}
    </div>
  );
}
