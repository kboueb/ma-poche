import { create } from "zustand";
import { isTauri } from "@/lib/tauri";
import { useSettingsStore } from "./useSettingsStore";

/** Code LAError renvoyé par le Rust sous la forme "code:message" (-2 = annulé par l'utilisateur). */
export function parseAuthError(raw: string): { cancelled: boolean; message: string } {
  const [code, ...rest] = raw.split(":");
  const n = Number(code);
  // -2 annulé par l'utilisateur, -4 annulé par le système, -9 annulé par l'app
  const cancelled = n === -2 || n === -4 || n === -9;
  return { cancelled, message: rest.join(":") || raw };
}

export async function touchIdAvailable(): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<boolean>("touchid_available");
  } catch {
    return false;
  }
}

// La fenêtre Touch ID fait perdre le focus à l'app : ce passage ne doit pas compter comme une absence
let authInProgress = false;
export const isAuthInProgress = () => authInProgress;

/** Demande Touch ID (ou le mot de passe de session). Lève une erreur "code:message" en cas d'échec. */
export async function authenticateWithTouchId(reason: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  authInProgress = true;
  try {
    await invoke("touchid_authenticate", { reason });
  } finally {
    authInProgress = false;
  }
}

interface LockState {
  /** Verrouillée au lancement si la protection est activée */
  locked: boolean;
  lock: () => void;
  unlock: () => void;
}

export const useLockStore = create<LockState>()((set) => ({
  locked: isTauri() && useSettingsStore.getState().appLockEnabled,
  lock: () => {
    if (useSettingsStore.getState().appLockEnabled) set({ locked: true });
  },
  unlock: () => set({ locked: false }),
}));

/** Faut-il reverrouiller après une absence (fenêtre en arrière-plan) ? */
export function shouldRelock(awayMs: number, relockAfterMinutes: number): boolean {
  return awayMs >= relockAfterMinutes * 60_000;
}
