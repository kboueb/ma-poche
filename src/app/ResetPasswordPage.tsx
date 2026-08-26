import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { translateError } from "@/lib/utils/errors";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenReady, setTokenReady] = useState(false);
  const [tokenError, setTokenError] = useState("");

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (accessToken && refreshToken) {
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ error }) => {
          if (error) {
            setTokenError("Lien de réinitialisation invalide ou expiré. Demande un nouveau lien.");
          } else {
            setTokenReady(true);
          }
        });
    } else {
      setTokenError("Lien de réinitialisation invalide. Demande un nouveau lien.");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(translateError(error.message));
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (tokenError) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-8 transition-colors duration-700"
        style={{ background: "linear-gradient(135deg, var(--surface-0) 0%, var(--surface-1) 100%)" }}
      >
        <div className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="text-center">
            <Logo size="md" className="mx-auto mb-6" />
          </div>
          <div className="bg-surface-1 border border-surface-3 rounded-2xl p-8 text-center space-y-4">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-500/10">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold">Lien invalide</h2>
            <p className="text-text-muted text-sm">{tokenError}</p>
            <Button onClick={() => navigate("/")} variant="secondary" className="w-full" size="lg">
              Retour à la connexion
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!tokenReady) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-8 transition-colors duration-700"
        style={{ background: "linear-gradient(135deg, var(--surface-0) 0%, var(--surface-1) 100%)" }}
      >
        <div className="w-full max-w-sm text-center animate-in fade-in duration-500">
          <Logo size="md" className="mx-auto mb-4 animate-pulse" />
          <p className="text-text-muted text-sm">Vérification du lien...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-8 transition-colors duration-700"
      style={{ background: "linear-gradient(135deg, var(--surface-0) 0%, var(--surface-1) 100%)" }}
    >
      <div className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <Logo size="md" className="mx-auto mb-6" />
        </div>

        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold">
              {success ? "Mot de passe mis à jour 🎉" : "Nouveau mot de passe"}
            </h2>
            <p className="text-text-muted text-sm mt-1">
              {success
                ? "Tu peux maintenant te connecter avec ton nouveau mot de passe."
                : "Choisis un nouveau mot de passe pour ton compte."}
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 mx-auto block">
                <CheckCircle className="w-8 h-8 text-emerald-400" />
              </div>
              <Button onClick={() => navigate("/")} className="w-full" size="lg">
                Se connecter
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type={showPassword ? "text" : "password"}
                label="Nouveau mot de passe"
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
              <Input
                type={showPassword ? "text" : "password"}
                label="Confirmer le mot de passe"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                icon={<Lock className="w-4 h-4" />}
                required
                minLength={6}
              />
              {error && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs font-medium text-center">
                  {error}
                </div>
              )}
              <Button type="submit" loading={loading} className="w-full" size="lg">
                Réinitialiser le mot de passe
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
