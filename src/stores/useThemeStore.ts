import { create } from "zustand";
import { persist } from "zustand/middleware";

type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  set: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: "dark",

      toggle: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        set({ theme: next });
      },

      set: (t) => {
        set({ theme: t });
      },
    }),
    { name: "mapoche-theme" }
  )
);

