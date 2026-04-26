import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import type { Category } from "@/types";

interface CategoriesState {
  categories: Category[];
  loading: boolean;
  fetch: () => Promise<void>;
  add: (c: Pick<Category, "name" | "icon" | "color" | "parent_id" | "flow">) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCategoriesStore = create<CategoriesState>((set) => ({
  categories: [],
  loading: false,

  fetch: async () => {
    set({ loading: true });
    const { data } = await supabase.from("categories").select("*").order("name");
    set({ categories: (data as Category[]) || [], loading: false });
  },

  add: async (c) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("categories").insert({ ...c, user_id: user.id }).select().single();
    if (data) set((s) => ({ categories: [...s.categories, data as Category] }));
  },

  remove: async (id) => {
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (!error) set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
  },
}));
