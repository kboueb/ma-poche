import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useProjectsStore } from "./useProjectsStore";
import { missionFromQuote, nextDocNumber, quoteTotals } from "@/lib/utils/missionMetrics";
import type { Project, Quote, QuoteItem } from "@/types";

type ItemInput = Pick<QuoteItem, "label" | "quantity" | "unit" | "unit_price">;

interface QuotesState {
  quotes: Quote[];
  loading: boolean;
  schemaError: boolean;
  fetch: () => Promise<void>;
  create: (data: {
    client_id: string | null;
    title: string;
    issue_date: string;
    valid_until: string | null;
    vat_rate: number;
    deposit_percent: number | null;
    notes: string | null;
    items: ItemInput[];
  }) => Promise<Quote | null>;
  update: (id: string, data: Partial<Pick<Quote, "title" | "valid_until" | "vat_rate" | "deposit_percent" | "notes" | "client_id">>) => Promise<void>;
  setStatus: (id: string, status: Quote["status"]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addItem: (quoteId: string, item: ItemInput) => Promise<void>;
  removeItem: (itemId: string, quoteId: string) => Promise<void>;
  duplicate: (q: Quote) => Promise<Quote | null>;
  /** Accepte le devis : crée la mission (TJM / budget déduits des lignes) et le jalon d'acompte. */
  accept: (q: Quote, clientName: string) => Promise<Project | null>;
}

export const useQuotesStore = create<QuotesState>((set, get) => ({
  quotes: [],
  loading: false,
  schemaError: false,

  fetch: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("quotes")
      .select("*, client:clients(*), items:quote_items(*)")
      .order("created_at", { ascending: false });
    set({
      quotes: ((data as Quote[]) || []).map((q) => ({
        ...q,
        items: [...(q.items || [])].sort((a, b) => a.position - b.position),
      })),
      loading: false,
      schemaError: (error as { code?: string } | null)?.code === "PGRST205",
    });
  },

  create: async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const year = new Date().getFullYear();
    const { data: last } = await supabase
      .from("quotes")
      .select("number")
      .like("number", `D-${year}-%`)
      .order("number", { ascending: false })
      .limit(1);
    const number = nextDocNumber("D", year, (last as Array<{ number: string }> | null)?.[0]?.number);
    const { items, ...fields } = data;
    const { data: q, error } = await supabase
      .from("quotes")
      .insert({ ...fields, user_id: user.id, number, status: "draft" })
      .select()
      .single();
    if (error || !q) {
      if ((error as { code?: string } | null)?.code === "PGRST205") {
        set({ schemaError: true });
        toast.error("Tables devis absentes : exécutez la migration add_clients_quotes.sql");
      } else {
        toast.error("Création du devis impossible");
      }
      return null;
    }
    if (items.length > 0) {
      await supabase.from("quote_items").insert(
        items.map((it, i) => ({ ...it, user_id: user.id, quote_id: (q as Quote).id, position: i })),
      );
    }
    await get().fetch();
    toast.success(`Devis ${number} créé`);
    return get().quotes.find((x) => x.id === (q as Quote).id) || (q as Quote);
  },

  update: async (id, data) => {
    await supabase.from("quotes").update(data).eq("id", id);
    set((s) => ({ quotes: s.quotes.map((q) => q.id === id ? { ...q, ...data } : q) }));
  },

  setStatus: async (id, status) => {
    const patch: Partial<Quote> = { status };
    if (status !== "accepted") patch.accepted_at = null;
    await supabase.from("quotes").update(patch).eq("id", id);
    set((s) => ({ quotes: s.quotes.map((q) => q.id === id ? { ...q, ...patch } : q) }));
  },

  remove: async (id) => {
    await supabase.from("quotes").delete().eq("id", id);
    set((s) => ({ quotes: s.quotes.filter((q) => q.id !== id) }));
    toast.success("Devis supprimé");
  },

  addItem: async (quoteId, item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const position = get().quotes.find((q) => q.id === quoteId)?.items?.length || 0;
    const { data } = await supabase
      .from("quote_items")
      .insert({ ...item, user_id: user.id, quote_id: quoteId, position })
      .select()
      .single();
    if (data) {
      set((s) => ({
        quotes: s.quotes.map((q) => q.id === quoteId ? { ...q, items: [...(q.items || []), data as QuoteItem] } : q),
      }));
    }
  },

  removeItem: async (itemId, quoteId) => {
    await supabase.from("quote_items").delete().eq("id", itemId);
    set((s) => ({
      quotes: s.quotes.map((q) => q.id === quoteId ? { ...q, items: (q.items || []).filter((i) => i.id !== itemId) } : q),
    }));
  },

  duplicate: async (q) => get().create({
    client_id: q.client_id,
    title: q.title,
    issue_date: new Date().toISOString().slice(0, 10),
    valid_until: null,
    vat_rate: Number(q.vat_rate),
    deposit_percent: q.deposit_percent != null ? Number(q.deposit_percent) : null,
    notes: q.notes,
    items: (q.items || []).map(({ label, quantity, unit, unit_price }) => ({ label, quantity, unit, unit_price })),
  }),

  accept: async (q, clientName) => {
    const items = q.items || [];
    const params = missionFromQuote(q, items);
    const today = new Date().toISOString().slice(0, 10);
    const projects = useProjectsStore.getState();
    const project = await projects.addProject({
      client_id: q.client_id,
      client_name: clientName,
      name: q.title,
      description: null,
      status: "active",
      ...params,
      recurring_monthly: false,
      start_date: today,
      deadline: null,
      color: "#6366f1",
      notes: `Créée depuis le devis ${q.number}`,
    });
    if (!project) return null;
    if (q.deposit_percent && Number(q.deposit_percent) > 0) {
      // Montant HT : facturé tel quel, la TVA s'ajoute sur la facture
      const { ht } = quoteTotals(items, q.vat_rate);
      await projects.addMilestone({
        project_id: project.id,
        title: `Acompte ${Number(q.deposit_percent)} % (devis ${q.number})`,
        kind: "payment",
        due_date: today,
        amount: Math.round(ht * Number(q.deposit_percent)) / 100,
        done: false,
        done_at: null,
        notes: null,
      });
    }
    const patch = { status: "accepted" as const, accepted_at: today, project_id: project.id };
    await supabase.from("quotes").update(patch).eq("id", q.id);
    set((s) => ({ quotes: s.quotes.map((x) => x.id === q.id ? { ...x, ...patch } : x) }));
    toast.success("Devis accepté : mission créée");
    return project;
  },
}));
