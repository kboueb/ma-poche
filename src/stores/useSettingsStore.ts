import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  currency: string;
  language: string;
  hasSeenTour: boolean;
  setCurrency: (c: string) => void;
  setLanguage: (l: string) => void;
  setHasSeenTour: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "XOF",
      language: "fr",
      hasSeenTour: false,
      setCurrency: (c) => set({ currency: c }),
      setLanguage: (l) => set({ language: l }),
      setHasSeenTour: (v) => set({ hasSeenTour: v }),
    }),
    {
      name: "mapoche-settings",
    }
  )
);
