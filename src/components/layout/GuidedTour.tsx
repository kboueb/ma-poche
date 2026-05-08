import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useLocation } from "react-router-dom";
import { X, ChevronRight, ChevronLeft } from "lucide-react";

interface TourStep {
  selector?: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

const STEPS: TourStep[] = [
  {
    title: "Bienvenue sur maPoche ! 👋",
    description:
      "Votre gestionnaire de finances personnel. Faisons un rapide tour pour vous aider à démarrer.",
  },
  {
    selector: ".tour-dashboard",
    title: "📊 Votre tableau de bord",
    description:
      "Ici, retrouvez vos revenus, dépenses et cash-flow du mois. Naviguez entre les mois avec les flèches en haut à droite.",
    position: "bottom",
  },
  {
    selector: ".tour-add-button",
    title: "➕ Ajouter une transaction",
    description:
      "Enregistrez rapidement une dépense, un revenu ou un virement. Sur mobile, utilisez le bouton central en bas de l'écran.",
    position: "bottom",
  },
  {
    selector: ".tour-nav-accounts",
    title: "🏦 Vos comptes",
    description:
      "Créez vos comptes bancaires (Courant, Épargne, Espèces…). maPoche calcule automatiquement vos soldes.",
    position: "right",
  },
  {
    selector: ".tour-nav-budgets",
    title: "🎯 Vos budgets",
    description:
      "Fixez des limites de dépenses par catégorie. maPoche vous alerte avant de dépasser votre budget !",
    position: "right",
  },
  {
    selector: ".tour-nav-patrimoine",
    title: "🏠 Votre patrimoine",
    description:
      "Suivez la valeur de vos actifs (immobilier, actions, épargne) et passifs (crédits) pour connaître votre patrimoine net.",
    position: "right",
  },
  {
    selector: ".tour-settings",
    title: "⚙️ Paramètres",
    description:
      "N'oubliez pas de configurer votre devise (EUR, FCFA, USD…) dans les réglages pour un affichage adapté.",
    position: "top",
  },
];

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function TourOverlay({
  step,
  stepIndex,
  total,
  rect,
  onNext,
  onPrev,
  onClose,
}: {
  step: TourStep;
  stepIndex: number;
  total: number;
  rect: HighlightRect | null;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}) {
  const PADDING = 8;
  const popoverWidth = 320;

  const highlighted = rect && step.selector;

  // Calculate popover position
  const getPopoverStyle = (): React.CSSProperties => {
    if (!highlighted || !rect) {
      // Centered for intro card
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: popoverWidth,
      };
    }

    const pos = step.position || "bottom";
    const styles: React.CSSProperties = {
      position: "fixed",
      width: popoverWidth,
    };

    switch (pos) {
      case "bottom":
        styles.top = rect.top + rect.height + PADDING + 10;
        styles.left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
        break;
      case "top":
        styles.bottom = window.innerHeight - rect.top + PADDING + 10;
        styles.left = Math.max(8, Math.min(rect.left, window.innerWidth - popoverWidth - 8));
        break;
      case "right":
        styles.top = Math.max(8, rect.top);
        styles.left = rect.left + rect.width + PADDING + 10;
        break;
      case "left":
        styles.top = Math.max(8, rect.top);
        styles.right = window.innerWidth - rect.left + PADDING + 10;
        break;
    }

    return styles;
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999]">
      {/* Backdrop with cutout for highlighted element */}
      {highlighted && rect ? (
        <>
          {/* Top */}
          <div
            className="absolute bg-black/60 backdrop-blur-[2px]"
            style={{ top: 0, left: 0, right: 0, height: rect.top - PADDING }}
          />
          {/* Bottom */}
          <div
            className="absolute bg-black/60 backdrop-blur-[2px]"
            style={{
              top: rect.top + rect.height + PADDING,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          {/* Left */}
          <div
            className="absolute bg-black/60 backdrop-blur-[2px]"
            style={{
              top: rect.top - PADDING,
              left: 0,
              width: rect.left - PADDING,
              height: rect.height + PADDING * 2,
            }}
          />
          {/* Right */}
          <div
            className="absolute bg-black/60 backdrop-blur-[2px]"
            style={{
              top: rect.top - PADDING,
              left: rect.left + rect.width + PADDING,
              right: 0,
              height: rect.height + PADDING * 2,
            }}
          />
          {/* Highlight border ring */}
          <div
            className="absolute rounded-xl pointer-events-none"
            style={{
              top: rect.top - PADDING,
              left: rect.left - PADDING,
              width: rect.width + PADDING * 2,
              height: rect.height + PADDING * 2,
              boxShadow: "0 0 0 3px #6366f1, 0 0 0 6px rgba(99,102,241,0.3)",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" />
      )}

      {/* Popover card */}
      <div
        style={getPopoverStyle()}
        className="animate-in fade-in slide-in-from-bottom-2 duration-200"
      >
        <div className="bg-surface-1 border border-surface-3 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              {Array.from({ length: total }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === stepIndex
                      ? "bg-brand-500 w-6"
                      : i < stepIndex
                      ? "bg-brand-500/40 w-2"
                      : "bg-surface-3 w-2"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="px-4 pb-2">
            <h3 className="text-base font-bold text-text-primary mb-1.5">{step.title}</h3>
            <p className="text-sm text-text-secondary leading-relaxed">{step.description}</p>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 pt-3">
            <button
              onClick={onClose}
              className="text-xs text-text-muted hover:text-text-secondary transition-colors"
            >
              Passer la visite
            </button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={onPrev}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-surface-2 hover:bg-surface-3 border border-surface-3 rounded-xl transition-colors font-medium"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Retour
                </button>
              )}
              <button
                onClick={onNext}
                className="flex items-center gap-1 px-4 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-xl transition-colors font-semibold"
              >
                {stepIndex === total - 1 ? "Terminer 🎉" : "Suivant"}
                {stepIndex < total - 1 && <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function GuidedTour() {
  const { hasSeenTour, setHasSeenTour } = useSettingsStore();
  const location = useLocation();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<HighlightRect | null>(null);
  const rafRef = useRef<number>();

  const currentStep = STEPS[stepIndex];

  const updateRect = useCallback(() => {
    if (!currentStep.selector) {
      setRect(null);
      return;
    }
    const el = document.querySelector(currentStep.selector);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    } else {
      setRect(null);
    }
  }, [currentStep.selector]);

  useEffect(() => {
    if (!active) return;
    updateRect();
    const onResize = () => updateRect();
    window.addEventListener("resize", onResize);
    // Poll for dynamic layouts
    rafRef.current = requestAnimationFrame(function tick() {
      updateRect();
      rafRef.current = requestAnimationFrame(tick);
    });
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active, updateRect]);

  // Start tour on first visit to dashboard
  useEffect(() => {
    if (!hasSeenTour && location.pathname === "/") {
      const timer = setTimeout(() => setActive(true), 800);
      return () => clearTimeout(timer);
    }
  }, [hasSeenTour, location.pathname]);

  const handleNext = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex((i) => i + 1);
    } else {
      setActive(false);
      setHasSeenTour(true);
    }
  };

  const handlePrev = () => {
    if (stepIndex > 0) setStepIndex((i) => i - 1);
  };

  const handleClose = () => {
    setActive(false);
    setHasSeenTour(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  };

  if (!active) return null;

  return (
    <TourOverlay
      step={currentStep}
      stepIndex={stepIndex}
      total={STEPS.length}
      rect={rect}
      onNext={handleNext}
      onPrev={handlePrev}
      onClose={handleClose}
    />
  );
}

// Hook to restart the tour from Settings
export function useRestartTour() {
  const { setHasSeenTour } = useSettingsStore();
  return () => setHasSeenTour(false);
}
