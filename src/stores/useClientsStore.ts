import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Client } from "@/types";

export type ClientInput = Omit<Client, "id" | "user_id" | "created_at">;

interface ClientsState {
  clients: Client[];
  loading: boolean;
  loaded: boolean;
  schemaError: boolean;
  fetch: () => Promise<void>;
  add: (c: ClientInput) => Promise<Client | null>;
  update: (id: string, data: Partial<ClientInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Client existant du même nom (insensible à la casse), sinon créé. Null si la table manque. */
  ensure: (name: string) => Promise<Client | null>;
}

export const emptyClient = (name = ""): ClientInput => ({
  name,
  contact_name: null,
  email: null,
  phone: null,
  address: null,
  siret: null,
  vat_number: null,
  payment_terms_days: 30,
  default_daily_rate: null,
  notes: null,
});

/** Bloc d'adresse du client pour les factures et devis. */
export function clientDetailsText(c: Client): string {
  return [
    c.contact_name,
    c.address,
    c.email,
    c.siret ? `SIRET : ${c.siret}` : null,
    c.vat_number ? `TVA : ${c.vat_number}` : null,
  ].filter(Boolean).join("\n");
}

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: [],
  loading: false,
  loaded: false,
  schemaError: false,

  fetch: async () => {
    set({ loading: true });
    const { data, error } = await supabase.from("clients").select("*").order("name", { ascending: true });
    set({
      clients: (data as Client[]) || [],
      loading: false,
      loaded: true,
      schemaError: (error as { code?: string } | null)?.code === "PGRST205",
    });
  },

  add: async (c) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...c, name: c.name.trim(), user_id: user.id })
      .select()
      .single();
    if (error || !data) {
      if ((error as { code?: string } | null)?.code === "PGRST205") set({ schemaError: true });
      else toast.error("Création du client impossible");
      return null;
    }
    set((s) => ({ clients: [...s.clients, data as Client].sort((a, b) => a.name.localeCompare(b.name)) }));
    return data as Client;
  },

  update: async (id, data) => {
    const { error } = await supabase.from("clients").update(data).eq("id", id);
    if (error) { toast.error("Mise à jour du client impossible"); return; }
    set((s) => ({ clients: s.clients.map((c) => c.id === id ? { ...c, ...data } : c) }));
    // Le nom du client est recopié sur ses missions
    if (data.name) await supabase.from("projects").update({ client_name: data.name }).eq("client_id", id);
  },

  remove: async (id) => {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) { toast.error("Suppression du client impossible"); return; }
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
  },

  ensure: async (name) => {
    const clean = name.trim();
    if (!clean || get().schemaError) return null;
    if (!get().loaded) await get().fetch();
    const found = get().clients.find((c) => c.name.toLowerCase() === clean.toLowerCase());
    if (found) return found;
    return get().add(emptyClient(clean));
  },
}));
