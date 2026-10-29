import { useEffect } from "react";
import { useLockStore, shouldRelock, isAuthInProgress } from "@/stores/useLockStore";
import { useSettingsStore } from "@/stores/useSettingsStore";

/** Reverrouille après un passage en arrière-plan trop long, et sur ⌘L. */
export function useAppLockWatcher() {
  const enabled = useSettingsStore((s) => s.appLockEnabled);

  useEffect(() => {
    if (!enabled) return;
    let awaySince: number | null = null;

    const away = () => {
      if (isAuthInProgress() || useLockStore.getState().locked) return;
      awaySince ??= Date.now();
    };
    const back = () => {
      if (awaySince === null) return;
      if (isAuthInProgress()) { awaySince = null; return; }
      const ms = Date.now() - awaySince;
      awaySince = null;
      if (shouldRelock(ms, useSettingsStore.getState().relockAfterMinutes)) useLockStore.getState().lock();
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? away() : back());
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        useLockStore.getState().lock();
      }
    };

    window.addEventListener("blur", away);
    window.addEventListener("focus", back);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("blur", away);
      window.removeEventListener("focus", back);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("keydown", onKey);
    };
  }, [enabled]);
}
