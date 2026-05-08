import { useEffect, useState } from "react";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    // Phase 1: enter (logo zooms in + text slides up)
    const t1 = setTimeout(() => setPhase("hold"), 800);
    // Phase 2: hold
    const t2 = setTimeout(() => setPhase("exit"), 2000);
    // Phase 3: exit (fade out + scale up)
    const t3 = setTimeout(() => onDone(), 2700);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none transition-all duration-700 ease-in-out ${
        phase === "exit" ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{ background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 40%, #ecfdf5 100%)" }}
    >
      {/* Decorative background blobs */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-30 blur-3xl"
        style={{
          background: "radial-gradient(circle, #10b981 0%, transparent 70%)",
          top: "-4rem",
          left: "-4rem",
          animation: "splash-pulse 3s ease-in-out infinite",
        }}
      />
      <div
        className="absolute w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{
          background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
          bottom: "-2rem",
          right: "-2rem",
          animation: "splash-pulse 3s ease-in-out infinite reverse",
        }}
      />

      {/* Logo image */}
      <div
        className="relative z-10 transition-all duration-700"
        style={{
          transform: phase === "enter" ? "scale(0.6) translateY(20px)" : "scale(1) translateY(0)",
          opacity: phase === "enter" ? 0 : 1,
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <img
          src="/logo.png"
          alt="maPoche"
          className="w-48 h-48 object-contain drop-shadow-2xl"
          style={{ filter: "drop-shadow(0 12px 40px rgba(16,185,129,0.4))" }}
        />
      </div>

      {/* App name text */}
      <div
        className="relative z-10 mt-2 text-center transition-all duration-700"
        style={{
          transitionDelay: "150ms",
          transform: phase === "enter" ? "translateY(16px)" : "translateY(0)",
          opacity: phase === "enter" ? 0 : 1,
        }}
      >
        <h1 className="text-5xl font-extrabold tracking-tight leading-none">
          <span style={{ color: "#ef4444" }}>ma</span>
          <span style={{ color: "#16a34a" }}>Poche</span>
        </h1>
        <p
          className="text-sm font-semibold mt-2 tracking-widest uppercase transition-all duration-500"
          style={{
            color: "#ca8a04",
            transitionDelay: "300ms",
            opacity: phase === "enter" ? 0 : 1,
          }}
        >
          — Gérez vos finances —
        </p>
      </div>

      {/* Loading dots */}
      <div
        className="relative z-10 flex items-center gap-2 mt-10 transition-all duration-500"
        style={{
          transitionDelay: "400ms",
          opacity: phase === "enter" ? 0 : phase === "exit" ? 0 : 1,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full"
            style={{
              backgroundColor: "#10b981",
              animation: `splash-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splash-pulse {
          0%, 100% { transform: scale(1); opacity: 0.25; }
          50% { transform: scale(1.15); opacity: 0.4; }
        }
        @keyframes splash-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.2); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
