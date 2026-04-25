import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { seedDefaultCategories } from "@/lib/seed";
import { translateError } from "@/lib/utils/errors";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  loading: boolean;
  init: () => Promise<void>;
  login: (email: string, password: string) => Promise<string | null>;
  register: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  init: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      seedDefaultCategories(session.user.id).catch(() => {});
    }
    set({ user: session?.user ?? null, loading: false });

    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        seedDefaultCategories(session.user.id).catch(() => {});
      }
      set({ user: session?.user ?? null });
    });
  },

  login: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? translateError(error.message) : null;
  },

  register: async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? translateError(error.message) : null;
  },

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },
}));
