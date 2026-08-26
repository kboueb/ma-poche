import { useState, useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { supabase } from "@/lib/supabase";
import { translateError } from "@/lib/utils/errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail, Lock, ArrowRight, ChevronRight, Eye, EyeOff, Send, CheckCircle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

// ─── Illustration components ───────────────────────────────────────────────

function IllustrationBudget() {
  return (
    <svg viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Background card */}
      <rect x="20" y="20" width="240" height="180" rx="20" fill="#dcfce7" />
      {/* Bar chart */}
      <rect x="55" y="100" width="32" height="75" rx="8" fill="#10b981" opacity="0.3" />
      <rect x="55" y="120" width="32" height="55" rx="8" fill="#10b981" />
      <rect x="104" y="75" width="32" height="100" rx="8" fill="#10b981" opacity="0.3" />
      <rect x="104" y="90" width="32" height="85" rx="8" fill="#10b981" />
      <rect x="153" y="55" width="32" height="120" rx="8" fill="#10b981" opacity="0.3" />
      <rect x="153" y="65" width="32" height="110" rx="8" fill="#10b981" />
      <rect x="202" y="40" width="32" height="135" rx="8" fill="#10b981" opacity="0.3" />
      <rect x="202" y="45" width="32" height="130" rx="8" fill="#f59e0b" />
      {/* Trend arrow */}
      <path d="M55 115 L104 90 L153 70 L218 48" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeDasharray="6 3" />
      <circle cx="218" cy="48" r="6" fill="#059669" />
      {/* Coin */}
      <circle cx="218" cy="48" r="20" fill="#fef9c3" stroke="#f59e0b" strokeWidth="2" opacity="0.9">
        <animate attributeName="cy" values="48;42;48" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x="218" y="53" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#d97706">€</text>
      {/* Label */}
      <rect x="60" y="30" width="100" height="20" rx="6" fill="white" opacity="0.7" />
      <text x="110" y="44" textAnchor="middle" fontSize="10" fill="#059669" fontWeight="600">Revenus +24%</text>
    </svg>
  );
}

function IllustrationGoals() {
  return (
    <svg viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Background */}
      <rect x="20" y="20" width="240" height="180" rx="20" fill="#fef3c7" />
      {/* Target circles */}
      <circle cx="140" cy="110" r="80" stroke="#fde68a" strokeWidth="12" />
      <circle cx="140" cy="110" r="55" stroke="#fbbf24" strokeWidth="10" />
      <circle cx="140" cy="110" r="30" stroke="#f59e0b" strokeWidth="8" />
      <circle cx="140" cy="110" r="12" fill="#d97706" />
      {/* Arrow */}
      <line x1="40" y1="40" x2="132" y2="103" stroke="#ee9a0d" strokeWidth="4" strokeLinecap="round" />
      <polygon points="132,96 140,110 124,106" fill="#ee9a0d" />
      {/* Sparks */}
      <circle cx="80" cy="60" r="4" fill="#f59e0b" opacity="0.7">
        <animate attributeName="opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx="200" cy="50" r="3" fill="#10b981" opacity="0.7">
        <animate attributeName="opacity" values="0.2;0.9;0.2" dur="1.8s" repeatCount="indefinite" />
      </circle>
      <circle cx="220" cy="160" r="5" fill="#6366f1" opacity="0.6">
        <animate attributeName="opacity" values="0.6;0.1;0.6" dur="2.2s" repeatCount="indefinite" />
      </circle>
      {/* Goal tag */}
      <rect x="155" y="55" width="85" height="26" rx="8" fill="white" opacity="0.9" />
      <text x="197" y="72" textAnchor="middle" fontSize="10" fill="#d97706" fontWeight="700">Objectif 🎯</text>
    </svg>
  );
}

function IllustrationPatrimoine() {
  return (
    <svg viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Background */}
      <rect x="20" y="20" width="240" height="180" rx="20" fill="#ede9fe" />
      {/* House */}
      <polygon points="140,45 90,90 190,90" fill="#8b5cf6" />
      <rect x="100" y="90" width="80" height="60" rx="4" fill="#7c3aed" />
      <rect x="125" y="115" width="30" height="35" rx="4" fill="#ddd6fe" />
      {/* Windows */}
      <rect x="108" y="100" width="18" height="14" rx="3" fill="#ddd6fe" />
      <rect x="154" y="100" width="18" height="14" rx="3" fill="#ddd6fe" />
      {/* Pie chart (portfolio) */}
      <circle cx="210" cy="65" r="30" fill="none" stroke="#e9d5ff" strokeWidth="14" />
      <circle cx="210" cy="65" r="30" fill="none" stroke="#8b5cf6" strokeWidth="14"
        strokeDasharray="60 95" strokeDashoffset="24" />
      <circle cx="210" cy="65" r="30" fill="none" stroke="#10b981" strokeWidth="14"
        strokeDasharray="25 130" strokeDashoffset="-36" />
      <circle cx="210" cy="65" r="30" fill="none" stroke="#f59e0b" strokeWidth="14"
        strokeDasharray="10 145" strokeDashoffset="-61" />
      {/* Net worth label */}
      <rect x="50" y="155" width="120" height="28" rx="8" fill="white" opacity="0.85" />
      <text x="110" y="167" textAnchor="middle" fontSize="9" fill="#7c3aed" fontWeight="600">Patrimoine net</text>
      <text x="110" y="178" textAnchor="middle" fontSize="11" fill="#7c3aed" fontWeight="800">+12 500 €</text>
    </svg>
  );
}

// ─── Slide data ────────────────────────────────────────────────────────────

const SLIDES = [
  {
    emoji: "💰",
    title: "Prenez le contrôle\nde votre argent",
    subtitle: "Suivez vos revenus, dépenses et épargne en temps réel. Chaque euro compte.",
    illustration: <IllustrationBudget />,
    gradient: "from-emerald-500 to-teal-600",
    bg: "from-emerald-50 to-teal-50",
    dark: "from-emerald-950 to-teal-950",
    accent: "#10b981",
  },
  {
    emoji: "🎯",
    title: "Atteignez vos\nobjectifs financiers",
    subtitle: "Voyage, maison, retraite... Définissez vos rêves et regardez-les devenir réalité.",
    illustration: <IllustrationGoals />,
    gradient: "from-amber-500 to-orange-600",
    bg: "from-amber-50 to-orange-50",
    dark: "from-amber-950 to-orange-950",
    accent: "#f59e0b",
  },
  {
    emoji: "🏦",
    title: "Construisez\nvotre patrimoine",
    subtitle: "Immobilier, actions, épargne… Visualisez votre richesse et faites-la grandir.",
    illustration: <IllustrationPatrimoine />,
    gradient: "from-violet-500 to-purple-600",
    bg: "from-violet-50 to-purple-50",
    dark: "from-violet-950 to-purple-950",
    accent: "#8b5cf6",
  },
];

// ─── Auth Form ─────────────────────────────────────────────────────────────

function AuthForm({ onBack, initialMode = "login" }: { onBack: () => void; initialMode?: "login" | "register" }) {
  const { login, register } = useAuthStore();
  const [isLogin, setIsLogin] = useState(initialMode === "login");
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const err = isLogin ? await login(email, password) : await register(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      setError(translateError(error.message));
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  if (forgotPassword) {
    return (
      <div className="animate-in slide-in-from-bottom-4 fade-in duration-400">
        <button
          onClick={() => { setForgotPassword(false); setResetSent(false); setError(""); }}
          className="mb-6 flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          ← Retour
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">
            {resetSent ? "Email envoyé 📩" : "Mot de passe oublié ?"}
          </h2>
          <p className="text-text-muted text-sm mt-1">
            {resetSent
              ? "Vérifie ta boîte mail et clique sur le lien pour réinitialiser ton mot de passe."
              : "Entre ton email et nous t'enverrons un lien pour créer un nouveau mot de passe."}
          </p>
        </div>

        {resetSent ? (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10">
              <CheckCircle className="w-8 h-8 text-emerald-400" />
            </div>
            <Button
              onClick={() => { setForgotPassword(false); setResetSent(false); }}
              variant="secondary"
              className="w-full"
              size="lg"
            >
              Retour à la connexion
            </Button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <Input
              type="email"
              label="Email"
              placeholder="toi@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              required
            />
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium text-center">
                {error}
              </div>
            )}
            <Button type="submit" loading={loading} className="w-full" size="lg" icon={<Send className="w-4 h-4" />}>
              Envoyer le lien
            </Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom-4 fade-in duration-400">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
      >
        ← Retour
      </button>


      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold">
          {isLogin ? "Content de te revoir 👋" : "Rejoins maPoche 🚀"}
        </h2>
        <p className="text-text-muted text-sm mt-1">
          {isLogin ? "Connecte-toi à ton espace" : "Crée ton compte gratuitement"}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type="email" label="Email" placeholder="toi@email.com"
          value={email} onChange={(e) => setEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" />} required
        />
        <Input
          type={showPassword ? "text" : "password"}
          label="Mot de passe"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="w-4 h-4" />}
          suffix={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="hover:text-text-primary transition-colors p-0.5"
              tabIndex={-1}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          required
          minLength={6}
        />
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium text-center">
            {error}
          </div>
        )}
        <Button type="submit" loading={loading} className="w-full" size="lg" icon={<ArrowRight className="w-4 h-4" />}>
          {isLogin ? "Connexion" : "Créer mon compte"}
        </Button>
      </form>

      {isLogin && (
        <button
          onClick={() => { setForgotPassword(true); setError(""); }}
          className="w-full mt-3 text-center text-xs text-text-muted hover:text-brand-400 underline underline-offset-4 transition-colors"
        >
          Mot de passe oublié ?
        </button>
      )}

      <button
        onClick={() => { setIsLogin(!isLogin); setError(""); }}
        className="w-full mt-4 text-center text-xs text-text-muted hover:text-brand-400 underline underline-offset-4 transition-colors"
      >
        {isLogin ? "Pas de compte ? S'inscrire" : "Déjà inscrit ? Se connecter"}
      </button>
    </div>
  );
}

// ─── Main onboarding ───────────────────────────────────────────────────────

export default function LoginPage() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [showAuth, setShowAuth] = useState<"login" | "register" | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const autoRef = useRef<ReturnType<typeof setTimeout>>();

  const slide = SLIDES[slideIndex];

  const goTo = useCallback((idx: number, dir: "next" | "prev") => {
    if (isAnimating) return;
    setIsAnimating(true);
    setDirection(dir);
    setTimeout(() => {
      setSlideIndex(idx);
      setIsAnimating(false);
    }, 350);
  }, [isAnimating]);

  const next = useCallback(() => {
    const idx = (slideIndex + 1) % SLIDES.length;
    goTo(idx, "next");
  }, [slideIndex, goTo]);

  // Auto-advance — stop when auth is open
  useEffect(() => {
    if (showAuth) return;
    autoRef.current = setTimeout(next, 4000);
    return () => clearTimeout(autoRef.current);
  }, [next, showAuth, slideIndex]);

  const handleDotClick = (i: number) => {
    clearTimeout(autoRef.current);
    goTo(i, i > slideIndex ? "next" : "prev");
  };

  return (
    <div
      className="min-h-screen flex flex-col md:flex-row overflow-hidden relative transition-colors duration-700"
      style={{
        background: `linear-gradient(135deg, var(--surface-0) 0%, var(--surface-1) 100%)`,
      }}
    >
      {/* ── Left / illustration panel ── */}
      <div
        className="relative flex-1 flex flex-col items-center justify-center p-8 md:p-16 overflow-hidden min-h-[55vh] md:min-h-screen transition-all duration-700"
        style={{ background: `linear-gradient(135deg, ${slide.accent}18 0%, ${slide.accent}08 100%)` }}
      >
        {/* Blobs */}
        <div
          className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-700"
          style={{ background: `radial-gradient(circle, ${slide.accent}40 0%, transparent 70%)`, top: "-6rem", left: "-6rem" }}
        />
        <div
          className="absolute w-64 h-64 rounded-full blur-3xl pointer-events-none transition-all duration-700"
          style={{ background: `radial-gradient(circle, ${slide.accent}25 0%, transparent 70%)`, bottom: "-4rem", right: "-4rem" }}
        />

        {/* Slide content */}
        <div
          className="relative z-10 max-w-sm w-full text-center transition-all duration-350"
          style={{
            opacity: isAnimating ? 0 : 1,
            transform: isAnimating
              ? `translateX(${direction === "next" ? "40px" : "-40px"})`
              : "translateX(0)",
          }}
        >
          {/* Illustration */}
          <div className="w-full max-w-xs mx-auto h-56 mb-6 drop-shadow-xl">
            {slide.illustration}
          </div>

          {/* Emoji badge */}
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl text-3xl mb-4 shadow-lg"
            style={{ background: `${slide.accent}20`, border: `2px solid ${slide.accent}40` }}
          >
            {slide.emoji}
          </div>

          <h1
            className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight mb-3 whitespace-pre-line"
            style={{ color: slide.accent }}
          >
            {slide.title}
          </h1>
          <p className="text-text-secondary text-base leading-relaxed">
            {slide.subtitle}
          </p>
        </div>

        {/* Dots */}
        <div className="relative z-10 flex items-center gap-2 mt-8">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDotClick(i)}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === slideIndex ? 24 : 8,
                height: 8,
                backgroundColor: i === slideIndex ? slide.accent : `${slide.accent}40`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Right / auth panel ── */}
      <div className="relative flex flex-col items-center justify-center p-8 md:p-14 md:w-[500px] bg-surface-1 border-t md:border-t-0 md:border-l border-surface-3">
        {/* maPoche — mobile */}
        <div className="absolute top-6 left-1/2 -translate-x-1/2 md:hidden">
          <Logo size="sm" />
        </div>

        <div className="w-full max-w-sm">
          {showAuth ? (
            <AuthForm onBack={() => setShowAuth(null)} initialMode={showAuth === "register" ? "register" : "login"} />
          ) : (
          <div className="text-center space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Logo large — desktop */}
              {/* <Logo size="lg" /> */}

              <div>
                <h2 className="text-3xl font-extrabold tracking-tight leading-tight">
                  Bienvenue sur{" "}
                  <span style={{ color: "#ee9a0d" }}>ma</span>
                  <span
                    style={{
                      background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >Poche</span>
                </h2>
                <p className="text-text-muted text-sm mt-2 leading-relaxed">
                  Votre gestionnaire de finances personnel,<br/>simple et puissant.
                </p>
              </div>

              <div className="space-y-3 w-full">
                <button
                  onClick={() => setShowAuth("register")}
                  className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-bold text-white text-base shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: `linear-gradient(135deg, ${slide.accent} 0%, ${slide.accent}bb 100%)`,
                    boxShadow: `0 8px 28px ${slide.accent}45`,
                  }}
                >
                  Commencer gratuitement
                  <ChevronRight className="w-5 h-5" />
                </button>

                <button
                  onClick={() => setShowAuth("login")}
                  className="w-full py-3.5 px-6 rounded-2xl font-semibold text-sm text-text-secondary hover:text-text-primary border border-surface-3 hover:border-surface-4 transition-all hover:bg-surface-2"
                >
                  J'ai déjà un compte
                </button>
              </div>

              <p className="text-[11px] text-text-muted">
                🔒 Gratuit · Sécurisé · Aucune CB requise
              </p>
            </div>
          )}
        </div>

        {/* Slide through button on mobile */}
        {!showAuth && (
          <button
            onClick={next}
            className="md:hidden absolute right-5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-surface-2 border border-surface-3 flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5 text-text-muted" />
          </button>
        )}
      </div>
    </div>
  );
}
