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
  /** App desktop verrouillée par Touch ID au lancement et après une absence */
  appLockEnabled: boolean;
  /** Minutes en arrière-plan avant reverrouillage (0 = à chaque retour) */
  relockAfterMinutes: number;
  /** Heures facturables dans une journée (conversion temps ↔ jours, TJM) */
  hoursPerDay: number;
  /** Jours de production disponibles par mois (charge / taux d'occupation) */
  capacityDaysPerMonth: number;
  setHoursPerDay: (v: number) => void;
  setCapacityDaysPerMonth: (v: number) => void;
  setCurrency: (c: string) => void;
  setHasSeenTour: (v: boolean) => void;
  setRemindersEnabled: (v: boolean) => void;
  setProvisionRate: (v: number) => void;
  setProvisionCategoryIds: (ids: string[]) => void;
  setAppLockEnabled: (v: boolean) => void;
  setRelockAfterMinutes: (v: number) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      currency: "XOF",
      hasSeenTour: false,
      remindersEnabled: false,
      provisionRate: 0,
      provisionCategoryIds: [],
      appLockEnabled: false,
      relockAfterMinutes: 5,
      hoursPerDay: 7,
      capacityDaysPerMonth: 18,
      setHoursPerDay: (v) => set({ hoursPerDay: Math.min(24, Math.max(1, v)) }),
      setCapacityDaysPerMonth: (v) => set({ capacityDaysPerMonth: Math.min(31, Math.max(1, v)) }),
      setCurrency: (c) => set({ currency: c }),
      setHasSeenTour: (v) => set({ hasSeenTour: v }),
      setRemindersEnabled: (v) => set({ remindersEnabled: v }),
      setProvisionRate: (v) => set({ provisionRate: Math.min(100, Math.max(0, v)) }),
      setProvisionCategoryIds: (ids) => set({ provisionCategoryIds: ids }),
      setAppLockEnabled: (v) => set({ appLockEnabled: v }),
      setRelockAfterMinutes: (v) => set({ relockAfterMinutes: Math.max(0, v) }),
    }),
    {
      name: "mapoche-settings",
    }
  )
);
