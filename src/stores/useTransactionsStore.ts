import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Transaction } from "@/types";

interface TransactionsState {
  transactions: Transaction[];
  loading: boolean;
  fetch: (filters?: { from?: string; to?: string; accountId?: string; categoryId?: string; flow?: string }) => Promise<void>;
  add: (t: Omit<Transaction, "id" | "user_id" | "created_at">) => Promise<void>;
  remove: (id: string) => Promise<void>;
  update: (id: string, data: Partial<Transaction>) => Promise<void>;
}

export const useTransactionsStore = create<TransactionsState>((set, get) => ({
  transactions: [],
  loading: false,

  fetch: async (filters) => {
    set({ loading: true });
    let q = supabase
      .from("transactions")
      .select("*, account:accounts(*), category:categories(*)")
      .order("date", { ascending: false })
      .limit(200);

    if (filters?.from) q = q.gte("date", filters.from);
    if (filters?.to) q = q.lte("date", filters.to);
    if (filters?.accountId) q = q.eq("account_id", filters.accountId);
    if (filters?.categoryId) q = q.eq("category_id", filters.categoryId);
    if (filters?.flow) q = q.eq("flow", filters.flow);

    const { data } = await q;
    set({ transactions: (data as Transaction[]) || [], loading: false });
  },

  add: async (t) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("transactions").insert({ ...t, user_id: user.id }).select("*, account:accounts(*), category:categories(*)").single();
    if (data) set((s) => ({ transactions: [data as Transaction, ...s.transactions] }));
  },

  remove: async (id) => {
    await supabase.from("transactions").delete().eq("id", id);
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }));
  },

  update: async (id, data) => {
    await supabase.from("transactions").update(data).eq("id", id);
    set((s) => ({ transactions: s.transactions.map((t) => t.id === id ? { ...t, ...data } : t) }));
  },
}));
