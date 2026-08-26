import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  currency: string;
  hasSeenTour: boolean;
  setCurrency: (c: string) => void;
  setHasSeenTour: (v: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "XOF",
      hasSeenTour: false,
      setCurrency: (c) => set({ currency: c }),
      setHasSeenTour: (v) => set({ hasSeenTour: v }),
    }),
    {
      name: "mapoche-settings",
    }
  )
);
