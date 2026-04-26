import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Budget } from "@/types";

interface BudgetsState {
  budgets: Budget[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (b: Omit<Budget, "id" | "user_id">) => Promise<void>;
  remove: (id: string) => Promise<void>;
  update: (id: string, data: Partial<Budget>) => Promise<void>;
}

export const useBudgetsStore = create<BudgetsState>((set) => ({
  budgets: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const { data } = await supabase
      .from("budgets")
      .select("*, category:categories(*)");
    set({ budgets: (data as Budget[]) || [], loading: false });
  },

  add: async (b) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("budgets")
      .insert({ ...b, user_id: user.id })
      .select("*, category:categories(*)")
      .single();
    if (data) set((s) => ({ budgets: [...s.budgets, data as Budget] }));
  },

  remove: async (id) => {
    await supabase.from("budgets").delete().eq("id", id);
    set((s) => ({ budgets: s.budgets.filter((b) => b.id !== id) }));
  },

  update: async (id, data) => {
    await supabase.from("budgets").update(data).eq("id", id);
    set((s) => ({ budgets: s.budgets.map((b) => b.id === id ? { ...b, ...data } : b) }));
  },
}));
