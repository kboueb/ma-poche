/**
 * Détecte l'exécution dans le runtime Tauri (app desktop) vs navigateur.
 * Tauri v2 expose `__TAURI_INTERNALS__` ; `__TAURI__` n'existe que si
 * `app.withGlobalTauri` est activé (pas notre cas).
 */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Alias explicite pour les services. */
export const isTauriRuntime = isTauri;

/** macOS uniquement (pour les ajustements traffic lights / titlebar). */
export function isMac(): boolean {
  return typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
}

/** Vrai quand on tourne dans l'app desktop macOS (titlebar Overlay active). */
export function isMacDesktop(): boolean {
  return isTauri() && isMac();
}
