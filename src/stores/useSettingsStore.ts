import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  currency: string;
  hasSeenTour: boolean;
  /** Rappels d'échéances et de factures en retard, envoyés au démarrage puis toutes les heures */
  remindersEnabled: boolean;
  /** Part de chaque encaissement client à mettre de côté pour impôts et charges, en % (0 = désactivé) */
  provisionRate: number;
  /** Catégories de dépenses comptées comme impôts/charges payés (vide = détection par le nom) */
  provisionCategoryIds: string[];
  setCurrency: (c: string) => void;
  setHasSeenTour: (v: boolean) => void;
  setRemindersEnabled: (v: boolean) => void;
  setProvisionRate: (v: number) => void;
  setProvisionCategoryIds: (ids: string[]) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "XOF",
      hasSeenTour: false,
      remindersEnabled: false,
      provisionRate: 0,
      provisionCategoryIds: [],
      setCurrency: (c) => set({ currency: c }),
      setHasSeenTour: (v) => set({ hasSeenTour: v }),
      setRemindersEnabled: (v) => set({ remindersEnabled: v }),
      setProvisionRate: (v) => set({ provisionRate: Math.min(100, Math.max(0, v)) }),
      setProvisionCategoryIds: (ids) => set({ provisionCategoryIds: ids }),
    }),
    {
      name: "mapoche-settings",
    }
  )
);
