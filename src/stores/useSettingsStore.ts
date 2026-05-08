import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  currency: string;
  language: string;
  setCurrency: (c: string) => void;
  setLanguage: (l: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "XOF",
      language: "fr",
      setCurrency: (c) => set({ currency: c }),
      setLanguage: (l) => set({ language: l }),
    }),
    {
      name: "mapoche-settings",
    }
  )
);
