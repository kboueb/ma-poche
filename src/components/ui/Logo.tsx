interface LogoProps {
  className?: string;
  showTagline?: boolean;
  size?: "sm" | "md" | "lg";
}

export function Logo({ className = "", showTagline = false, size = "md" }: LogoProps) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="flex flex-col">
          <h1 className={`${size === "lg" ? "text-4xl" : size === "sm" ? "text-xl" : "text-2xl"} font-bold hidden md:flex tracking-tight items-baseline leading-none`}>
            <span style={{ color: "#ee9a0d" }}>ma</span>
            <span style={{ color: "#16a34a" }}>Poche</span>
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
