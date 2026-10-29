import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Invoice, InvoicePayment } from "@/types";

// Client Supabase factice : enregistre chaque appel (table, opération, données, filtre).
type Call = { table: string; op: "insert" | "update" | "delete" | "select"; payload?: unknown; eq?: [string, unknown] };
const calls: Call[] = [];

vi.mock("@/lib/supabase", () => {
  const builder = (table: string) => {
    const call: Call = { table, op: "select" };
    const chain = {
      select: () => chain,
      order: () => Promise.resolve({ data: [], error: null }),
      single: () => Promise.resolve({ data: { id: `${table}-new` }, error: null }),
      insert: (payload: unknown) => { call.op = "insert"; call.payload = payload; calls.push(call); return chain; },
      update: (payload: unknown) => { call.op = "update"; call.payload = payload; calls.push(call); return chain; },
      delete: () => { call.op = "delete"; calls.push(call); return chain; },
      eq: (col: string, val: unknown) => { call.eq = [col, val]; return Promise.resolve({ data: null, error: null }); },
    };
    return chain;
  };
  return {
    supabase: {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "u1" } } }) },
      from: builder,
    },
  };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const { useInvoicesStore } = await import("./useInvoicesStore");

const payment = (over: Partial<InvoicePayment>): InvoicePayment => ({
  id: "p", user_id: "u1", invoice_id: "inv1", label: "Acompte", amount_due: 300, amount_paid: 0,
  due_date: null, paid_date: null, status: "pending", transaction_id: null, created_at: "",
  ...over,
});

const invoice = (payments: InvoicePayment[]): Invoice => ({
  id: "inv1", user_id: "u1", project_id: "proj1", number: "2026-007", status: "sent",
  issue_date: "2026-01-01", due_date: null, vat_rate: 0, notes: null, issuer_name: null, issuer_details: null,
  client_details: null, payment_terms: null, transaction_id: null, paid_at: null, created_at: "",
  items: [], payments,
});

describe("useInvoicesStore.markPaymentPaid", () => {
  beforeEach(() => {
    calls.length = 0;
    // fetch() est rappelé après le paiement : on le neutralise pour garder l'état de départ
    useInvoicesStore.setState({ fetch: vi.fn().mockResolvedValue(undefined) });
  });

  it("enregistre une recette liée à la mission et le montant payé de l'échéance", async () => {
    useInvoicesStore.setState({ invoices: [invoice([payment({ id: "a" }), payment({ id: "b", label: "Solde", amount_due: 700 })])] });
    await useInvoicesStore.getState().markPaymentPaid("a", "acc1");

    const tx = calls.find((c) => c.table === "transactions" && c.op === "insert");
    expect(tx?.payload).toMatchObject({ amount: 300, flow: "income", account_id: "acc1", project_id: "proj1", description: "Facture 2026-007 — Acompte" });

    const upd = calls.find((c) => c.table === "invoice_payments" && c.op === "update");
    expect(upd?.payload).toMatchObject({ status: "paid", amount_paid: 300, transaction_id: "transactions-new" });
    expect(upd?.eq).toEqual(["id", "a"]);

    // Une échéance reste due : la facture ne passe pas à « payée »
    expect(calls.some((c) => c.table === "invoices" && c.op === "update")).toBe(false);
  });

  it("la dernière échéance réglée solde la facture", async () => {
    useInvoicesStore.setState({ invoices: [invoice([payment({ id: "a", status: "paid", amount_paid: 300 }), payment({ id: "b", amount_due: 700 })])] });
    await useInvoicesStore.getState().markPaymentPaid("b", "acc1");

    const inv = calls.find((c) => c.table === "invoices" && c.op === "update");
    expect(inv?.payload).toMatchObject({ status: "paid" });
    expect(inv?.eq).toEqual(["id", "inv1"]);
  });

  it("échéance inconnue : aucune écriture", async () => {
    useInvoicesStore.setState({ invoices: [invoice([payment({ id: "a" })])] });
    await useInvoicesStore.getState().markPaymentPaid("zzz", "acc1");
    expect(calls).toHaveLength(0);
  });
});
