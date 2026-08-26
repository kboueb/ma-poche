import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Account } from "@/types";

interface AccountsState {
  accounts: Account[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (a: Pick<Account, "name" | "type" | "institution" | "currency" | "color" | "initial_balance" | "current_balance">) => Promise<void>;
  update: (id: string, data: Partial<Account>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useAccountsStore = create<AccountsState>((set) => ({
  accounts: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const { data } = await supabase.from("accounts").select("*").order("created_at");
    set({ accounts: (data as Account[]) || [], loading: false });
  },

  add: async (a) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("accounts").insert({ ...a, user_id: user.id }).select().single();
    if (data) set((s) => ({ accounts: [...s.accounts, data as Account] }));
  },

  update: async (id, data) => {
    await supabase.from("accounts").update(data).eq("id", id);
    set((s) => ({ accounts: s.accounts.map((a) => a.id === id ? { ...a, ...data } : a) }));
  },

  remove: async (id) => {
    await supabase.from("accounts").delete().eq("id", id);
    set((s) => ({ accounts: s.accounts.filter((a) => a.id !== id) }));
  },
}));
