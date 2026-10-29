import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import type { Invoice, InvoiceItem } from "@/types";

function isMissingTableError(e: unknown): boolean {
  return typeof e === "object" && e !== null &&
    "code" in e && (e as { code: string }).code === "PGRST205";
}

function totalTTC(items: InvoiceItem[], vatRate: number): number {
  const ht = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
  return ht * (1 + Number(vatRate) / 100);
}

interface InvoicesState {
  invoices: Invoice[];
  loading: boolean;
  schemaError: boolean;
  fetch: () => Promise<void>;
  nextNumber: () => Promise<string>;
  create: (data: {
    project_id: string | null;
    issue_date: string;
    due_date: string | null;
    vat_rate: number;
    notes: string | null;
    issuer_name: string | null;
    issuer_details: string | null;
    client_details: string | null;
    payment_terms: string | null;
    items: Array<{ label: string; quantity: number; unit_price: number; kind: InvoiceItem["kind"] }>;
    payments?: Array<{ label: string; amount_due: number; due_date: string | null }>;
    entryIds?: string[];
  }) => Promise<Invoice | null>;
  updateStatus: (id: string, status: Invoice["status"]) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addItem: (invoiceId: string, item: { label: string; quantity: number; unit_price: number; kind: InvoiceItem["kind"] }) => Promise<void>;
  removeItem: (itemId: string, invoiceId: string) => Promise<void>;
  // Paiements partiels (échéances)
  addPayment: (invoiceId: string, payment: { label: string; amount_due: number; due_date: string | null }) => Promise<void>;
  markPaymentPaid: (paymentId: string, accountId: string) => Promise<void>;
  removePayment: (paymentId: string, invoiceId: string) => Promise<void>;
  markInvoicePaid: (invoice: Invoice, accountId: string, ttcOverride?: number) => Promise<void>;
}

export const useInvoicesStore = create<InvoicesState>((set, get) => ({
  invoices: [],
  loading: false,
  schemaError: false,

  fetch: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from("invoices")
      .select("*, project:projects(*), items:invoice_items(*), payments:invoice_payments(*)")
      .order("created_at", { ascending: false });
    const rows = ((data as Invoice[]) || []).map((inv) => ({
      ...inv,
      items: [...(inv.items || [])].sort((a, b) => a.position - b.position),
      payments: [...(inv.payments || [])].sort((a, b) => {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return a.due_date.localeCompare(b.due_date);
      }),
    }));
    set({
      invoices: rows,
      loading: false,
      schemaError: (error as { code?: string } | null)?.code === "PGRST205",
    });
  },

  nextNumber: async () => {
    const year = new Date().getFullYear();
    const { data } = await supabase
      .from("invoices")
      .select("number")
      .like("number", `${year}-%`)
      .order("number", { ascending: false })
      .limit(1);
    const last = (data as Array<{ number: string }>)?.[0]?.number;
    const n = last ? parseInt(last.split("-")[1] || "0", 10) + 1 : 1;
    return `${year}-${String(n).padStart(3, "0")}`;
  },

  create: async (data) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const number = await get().nextNumber();
    const { data: inv, error } = await supabase
      .from("invoices")
      .insert({
        user_id: user.id,
        project_id: data.project_id,
        number,
        status: "draft",
        issue_date: data.issue_date,
        due_date: data.due_date,
        vat_rate: data.vat_rate,
        notes: data.notes,
        issuer_name: data.issuer_name,
        issuer_details: data.issuer_details,
        client_details: data.client_details,
        payment_terms: data.payment_terms,
      })
      .select()
      .single();
    if (error || !inv) {
      if (isMissingTableError(error)) {
        set({ schemaError: true });
        toast.error("Tables factures absentes : exécutez la migration add_invoices.sql dans Supabase");
      } else {
        toast.error("Création de la facture impossible");
      }
      return null;
    }
    const invoice = inv as Invoice;
    if (data.items.length > 0) {
      await supabase.from("invoice_items").insert(
        data.items.map((it, i) => ({
          user_id: user.id,
          invoice_id: invoice.id,
          label: it.label,
          quantity: it.quantity,
          unit_price: it.unit_price,
          kind: it.kind,
          position: i,
        }))
      );
    }
    if (data.payments && data.payments.length > 0) {
      const { error: payError } = await supabase.from("invoice_payments").insert(
        data.payments.map((p) => ({
          user_id: user.id,
          invoice_id: invoice.id,
          label: p.label,
          amount_due: p.amount_due,
          amount_paid: 0,
          due_date: p.due_date,
          status: "pending",
        }))
      );
      if (payError) toast.error(isMissingTableError(payError)
        ? "Échéances non enregistrées : exécutez la migration add_invoice_payments.sql"
        : "Échéances non enregistrées");
    }
    if (data.entryIds && data.entryIds.length > 0) {
      await supabase.from("time_entries").update({ invoice_id: invoice.id }).in("id", data.entryIds);
    }
    await get().fetch();
    toast.success(`Facture ${number} créée`);
    return invoice;
  },

  updateStatus: async (id, status) => {
    await supabase.from("invoices").update({ status }).eq("id", id);
    set((s) => ({ invoices: s.invoices.map((i) => i.id === id ? { ...i, status } : i) }));
  },

  remove: async (id) => {
    await supabase.from("invoices").delete().eq("id", id);
    set((s) => ({ invoices: s.invoices.filter((i) => i.id !== id) }));
    toast.success("Facture supprimée");
  },

  addItem: async (invoiceId, item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const inv = get().invoices.find((i) => i.id === invoiceId);
    const position = (inv?.items?.length || 0);
    const { data } = await supabase
      .from("invoice_items")
      .insert({ user_id: user.id, invoice_id: invoiceId, ...item, position })
      .select()
      .single();
    if (data) {
      set((s) => ({
        invoices: s.invoices.map((i) =>
          i.id === invoiceId ? { ...i, items: [...(i.items || []), data as InvoiceItem] } : i
        ),
      }));
    }
  },

  removeItem: async (itemId, invoiceId) => {
    await supabase.from("invoice_items").delete().eq("id", itemId);
    set((s) => ({
      invoices: s.invoices.map((i) =>
        i.id === invoiceId ? { ...i, items: (i.items || []).filter((x) => x.id !== itemId) } : i
      ),
    }));
  },

  // ---------- Paiements partiels ----------

  addPayment: async (invoiceId, payment) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("invoice_payments")
      .insert({
        user_id: user.id,
        invoice_id: invoiceId,
        label: payment.label,
        amount_due: payment.amount_due,
        amount_paid: 0,
        due_date: payment.due_date,
        status: "pending",
      })
      .select()
      .single();
    if (error || !data) {
      toast.error("Impossible d'ajouter l'échéance");
      return;
    }
    await get().fetch();
    toast.success("Échéance ajoutée");
  },

  markPaymentPaid: async (paymentId, accountId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const invoice = get().invoices.find((i) => (i.payments || []).some((p) => p.id === paymentId));
    const payment = invoice?.payments?.find((p) => p.id === paymentId);
    if (!invoice || !payment) {
      toast.error("Échéance introuvable");
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    // Recette liée à la mission
    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: accountId,
        category_id: null,
        amount: payment.amount_due,
        flow: "income",
        date: today,
        description: `Facture ${invoice.number} — ${payment.label}${invoice.project ? ` (${invoice.project.client_name})` : ""}`,
        project_id: invoice.project_id,
        is_reviewed: false,
      })
      .select()
      .single();
    if (error || !tx) {
      toast.error("Enregistrement du paiement impossible");
      return;
    }
    await supabase
      .from("invoice_payments")
      .update({ status: "paid", amount_paid: payment.amount_due, paid_date: today, transaction_id: (tx as { id: string }).id })
      .eq("id", paymentId);
    // Dernière échéance réglée → la facture passe à « payée »
    const allPaid = (invoice.payments || []).every((p) => p.id === paymentId || p.status === "paid");
    if (allPaid) {
      await supabase.from("invoices").update({ status: "paid", paid_at: today }).eq("id", invoice.id);
    }
    await get().fetch();
    toast.success(allPaid ? `Facture ${invoice.number} entièrement payée` : "Paiement enregistré");
  },

  removePayment: async (paymentId) => {
    await supabase.from("invoice_payments").delete().eq("id", paymentId);
    await get().fetch();
    toast.success("Échéance supprimée");
  },

  markInvoicePaid: async (invoice, accountId, ttcOverride) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const ttc = ttcOverride ?? totalTTC(invoice.items || [], Number(invoice.vat_rate));
    const { data: tx, error } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: accountId,
        category_id: null,
        amount: ttc,
        flow: "income",
        date: new Date().toISOString().slice(0, 10),
        description: `Facture ${invoice.number}${invoice.project ? ` — ${invoice.project.client_name}` : ""}`,
        project_id: invoice.project_id,
        is_reviewed: false,
      })
      .select()
      .single();
    if (error || !tx) {
      toast.error("Enregistrement du paiement impossible");
      return;
    }
    await supabase
      .from("invoices")
      .update({ status: "paid", paid_at: new Date().toISOString().slice(0, 10), transaction_id: (tx as { id: string }).id })
      .eq("id", invoice.id);
    await get().fetch();
    toast.success("Facture marquée payée, recette enregistrée");
  },
}));
