import { useState } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Mail, Lock, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export default function LoginPage() {
  const { login, register } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const err = isLogin ? await login(email, password) : await register(email, password);
    if (err) setError(err);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-surface-0 flex items-center justify-center p-6">
      {/* Decorative */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-500/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-sm space-y-8 relative z-10">
        <div className="text-center">
          <Logo size="lg" showTagline className="mb-4" />
          <p className="text-text-muted text-sm mt-2">
            {isLogin ? "Connecte-toi à ton espace" : "Crée ton compte gratuit"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email"
            placeholder="toi@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={<Mail className="w-4 h-4" />}
            required
          />
          <Input
            type="password"
            label="Mot de passe"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            icon={<Lock className="w-4 h-4" />}
            required
            minLength={6}
          />

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium text-center">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full" size="lg" icon={<ArrowRight className="w-4 h-4" />}>
            {isLogin ? "Connexion" : "Inscription"}
          </Button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(""); }}
          className="w-full text-center text-xs text-text-muted hover:text-brand-400 underline underline-offset-4 transition-colors"
        >
          {isLogin ? "Pas de compte ? S'inscrire" : "Déjà inscrit ? Se connecter"}
        </button>
      </div>
    </div>
  );
}
