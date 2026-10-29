import { create } from "zustand";

interface UIState {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  togglePalette: () => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  txModalOpen: boolean;
  setTxModalOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  paletteOpen: false,
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
  shortcutsOpen: false,
  setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
  txModalOpen: false,
  setTxModalOpen: (open) => set({ txModalOpen: open }),
}));

function isTypingTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
}

/** Raccourcis globaux : ⌘K/Ctrl+K palette, N nouvelle transaction, ? aide. */
export function initGlobalShortcuts() {
  if (typeof window === "undefined") return () => {};
  const onKey = (e: KeyboardEvent) => {
    const { paletteOpen, togglePalette, setShortcutsOpen, setTxModalOpen } = useUIStore.getState();
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      togglePalette();
      return;
    }
    if (isTypingTarget(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (paletteOpen) return; // la palette gère ses propres touches
    if (e.key === "?") {
      e.preventDefault();
      setShortcutsOpen(true);
    } else if (e.key.toLowerCase() === "n") {
      e.preventDefault();
      setTxModalOpen(true);
    }
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}
