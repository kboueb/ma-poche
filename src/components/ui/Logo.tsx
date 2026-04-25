interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className = "", showTagline = false, size = "md" }: LogoProps) {
  const sizes = {
    sm: "h-8",
    md: "h-12",
    lg: "h-20",
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <img src="/logo.png" alt="maPoche Logo" className={`${sizes[size]} w-auto object-contain drop-shadow-sm`} />
        <div className="flex flex-col">
          <h1 className={`${size === "lg" ? "text-4xl" : "text-2xl"} font-bold tracking-tight flex items-baseline leading-none`}>
            <span className="text-[#10b981]">ma</span>
            <span className="text-[#1e293b] dark:text-slate-100">Poche</span>
          </h1>
        </div>
      </div>
      {showTagline && (
        <p className="text-[10px] text-text-muted uppercase tracking-[0.3em] font-bold mt-1">
          Gérez. Suivez. Économisez.
        </p>
      )}
    </div>
  );
}
