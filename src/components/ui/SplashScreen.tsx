import { useEffect, useState } from "react";
import { Logo } from "@/components/ui/Logo";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 600);
    const t2 = setTimeout(() => setPhase("exit"), 1800);
    const t3 = setTimeout(() => onDone(), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none transition-all duration-600 ease-in-out bg-surface-0 ${
        phase === "exit" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Subtle ambient glow */}
      <div
        className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-10"
        style={{
          background: "radial-gradient(circle, #16a34a 0%, transparent 70%)",
          top: "10%",
          left: "50%",
          transform: "translateX(-50%)",
        }}
      />

      {/* Logo text */}
      <div
        className="relative z-10 transition-all duration-600"
        style={{
          transform: phase === "enter" ? "scale(0.85) translateY(12px)" : "scale(1) translateY(0)",
          opacity: phase === "enter" ? 0 : 1,
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <Logo size="lg" showTagline />
      </div>

      {/* Loading dots */}
      <div
        className="relative z-10 flex items-center gap-2 mt-10 transition-all duration-400"
        style={{
          opacity: phase === "hold" ? 1 : 0,
        }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-brand-500"
            style={{
              animation: `splash-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes splash-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
