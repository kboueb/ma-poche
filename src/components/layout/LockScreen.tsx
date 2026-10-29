import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, LogOut } from "lucide-react";
import { LogoMark } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { useLockStore, authenticateWithTouchId, parseAuthError } from "@/stores/useLockStore";
import { useAuthStore } from "@/stores/useAuthStore";

/** Écran opaque au-dessus de l'app tant que Touch ID n'a pas été validé. */
export function LockScreen() {
  const unlock = useLockStore((s) => s.unlock);
  const logout = useAuthStore((s) => s.logout);
  const [prompting, setPrompting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  // Après une annulation, on attend un clic : sinon le retour du focus relancerait Touch ID en boucle
  const autoPrompt = useRef(true);

  const tryUnlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPrompting(true);
    setError(null);
    try {
      await authenticateWithTouchId("déverrouiller maPoche");
      unlock();
    } catch (e) {
      const { cancelled, message } = parseAuthError(String(e));
      autoPrompt.current = false;
      if (!cancelled) setError(message);
    } finally {
      busy.current = false;
      setPrompting(false);
    }
  }, [unlock]);

  // Demande Touch ID dès l'affichage, puis à chaque retour sur la fenêtre
  useEffect(() => {
    const onFocus = () => { if (autoPrompt.current) tryUnlock(); };
    const t = setTimeout(onFocus, 300);
    window.addEventListener("focus", onFocus);
    return () => { clearTimeout(t); window.removeEventListener("focus", onFocus); };
  }, [tryUnlock]);

  return (
    <div
      className="fixed inset-0 z-[99990] flex flex-col items-center justify-center gap-6 bg-surface-0 px-6 select-none"
      data-tauri-drag-region
      role="dialog"
      aria-modal="true"
      aria-label="maPoche est verrouillée"
    >
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-brand-500/10 blur-3xl" />
      <LogoMark className="relative w-16 h-16" />
      <div className="relative text-center">
        <h1 className="text-xl font-bold">maPoche est verrouillée</h1>
        <p className="text-sm text-text-muted mt-1">Utilisez Touch ID ou le mot de passe de votre Mac</p>
      </div>
      <Button size="lg" icon={<Fingerprint className="w-5 h-5" />} loading={prompting} onClick={() => { autoPrompt.current = true; tryUnlock(); }} className="relative">
        Déverrouiller
      </Button>
      {error && <p className="relative text-xs text-rose-400 max-w-xs text-center">{error}</p>}
      <button
        onClick={() => { unlock(); logout(); }}
        className="relative mt-4 flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" /> Se déconnecter
      </button>
    </div>
  );
}
