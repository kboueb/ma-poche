import { describe, it, expect } from "vitest";
import { computeUpcomingPayments } from "./upcomingPayments";
import type { Transaction, Liability, Project, Milestone, Invoice, InvoiceItem, InvoicePayment } from "@/types";

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: "tx",
  user_id: "u",
  account_id: "acc-1",
  category_id: null,
  amount: 100,
  flow: "expense",
  transfer_to_account_id: null,
  date: "2026-01-15",
  description: "Loyer",
  note: null,
  tags: [],
  recurrence_rule: null,
  recurrence_parent_id: null,
  is_reviewed: false,
  created_at: "",
  ...over,
});

const proj = (over: Partial<Project> = {}): Project => ({
  id: "p1",
  user_id: "u",
  client_name: "Client",
  name: "Mission",
  description: null,
  status: "active",
  total_amount: null,
  hourly_rate: null,
  start_date: null,
  deadline: null,
  color: "#fff",
  notes: null,
  created_at: "",
  ...over,
});

const ms = (over: Partial<Milestone> = {}): Milestone => ({
  id: "m1",
  user_id: "u",
  project_id: "p1",
  title: "Validation",
  kind: "validation",
  due_date: null,
  amount: null,
  done: false,
  done_at: null,
  notes: null,
  created_at: "",
  ...over,
});

const invoice = (over: Partial<Invoice> = {}): Invoice => ({
  id: "i1",
  user_id: "u",
  project_id: null,
  number: "2026-001",
  status: "sent",
  issue_date: "2026-01-01",
  due_date: null,
  vat_rate: 0,
  notes: null,
  issuer_name: null,
  issuer_details: null,
  client_details: null,
  payment_terms: null,
  transaction_id: null,
  paid_at: null,
  created_at: "",
  items: [],
  payments: [],
  ...over,
});

const item = (over: Partial<InvoiceItem> = {}): InvoiceItem => ({
  id: "it", user_id: "u", invoice_id: "i1", label: "Dev", quantity: 1, unit_price: 100, kind: "other", position: 0, created_at: "",
  ...over,
});

const payment = (over: Partial<InvoicePayment> = {}): InvoicePayment => ({
  id: "p", user_id: "u", invoice_id: "i1", label: "Acompte", amount_due: 100, amount_paid: 0,
  due_date: null, paid_date: null, status: "pending", transaction_id: null, created_at: "",
  ...over,
});

const isoDay = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

describe("computeUpcomingPayments", () => {
  it("projette les occurrences futures d'une récurrence mensuelle active", () => {
    const past = new Date();
    past.setMonth(past.getMonth() - 2);
    const parent = tx({ id: "par", date: past.toISOString().slice(0, 10), recurrence_rule: "monthly" });
    const out = computeUpcomingPayments([parent], [], [], [], 60);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].source).toBe("recurrence");
    expect(out[0].daysUntil).toBeGreaterThanOrEqual(0);
  });

  it("ignore les récurrences en pause", () => {
    const parent = tx({ id: "par", date: "2026-01-15", recurrence_rule: "monthly", is_active: false });
    expect(computeUpcomingPayments([parent], [], [], [], 60)).toHaveLength(0);
  });

  it("ignore les passifs sans mensualité", () => {
    const liab = { id: "l", remaining_amount: 5000, monthly_payment: null } as Liability;
    expect(computeUpcomingPayments([], [liab], [], [], 60)).toHaveLength(0);
  });

  it("inclut la deadline d'un projet actif", () => {
    const p = proj({ deadline: isoDay(10) });
    const out = computeUpcomingPayments([], [], [], [], 60, [p], []);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("project");
    expect(out[0].flow).toBe("none");
    expect(out[0].daysUntil).toBe(10);
  });

  it("inclut les projets en retard (jours négatifs)", () => {
    const p = proj({ deadline: isoDay(-5) });
    const out = computeUpcomingPayments([], [], [], [], 60, [p], []);
    expect(out).toHaveLength(1);
    expect(out[0].daysUntil).toBe(-5);
  });

  it("ignore les projets non actifs et sans deadline", () => {
    const archived = proj({ id: "a", status: "archived", deadline: isoDay(5) });
    const noDate = proj({ id: "b", deadline: null });
    expect(computeUpcomingPayments([], [], [], [], 60, [archived, noDate], [])).toHaveLength(0);
  });

  it("jalon paiement = revenu avec montant, jalon terminé exclu", () => {
    const p = proj({});
    const pay = ms({ id: "mp", kind: "payment", due_date: isoDay(3), amount: 500 });
    const done = ms({ id: "md", kind: "validation", due_date: isoDay(2), done: true });
    const out = computeUpcomingPayments([], [], [], [], 60, [p], [pay, done]);
    expect(out).toHaveLength(1);
    expect(out[0].flow).toBe("income");
    expect(out[0].amount).toBe(500);
  });

  it("facture envoyée sans échéances : une ligne au TTC à la date d'échéance", () => {
    const inv = invoice({ due_date: isoDay(10), vat_rate: 20, items: [item({ quantity: 2, unit_price: 100 })] });
    const out = computeUpcomingPayments([], [], [], [], 60, [], [], [inv]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "inv-i1", source: "invoice", flow: "income", amount: 240, daysUntil: 10 });
  });

  it("facture à échéances : seules les échéances non réglées et datées, au montant restant", () => {
    const inv = invoice({
      payments: [
        payment({ id: "a", amount_due: 300, amount_paid: 300, status: "paid", due_date: isoDay(-5) }),
        payment({ id: "b", amount_due: 700, due_date: isoDay(-2) }),
        payment({ id: "c", amount_due: 100, due_date: null }),
      ],
    });
    const out = computeUpcomingPayments([], [], [], [], 60, [], [], [inv]);
    expect(out.map((o) => o.id)).toEqual(["invp-b"]);
    expect(out[0]).toMatchObject({ amount: 700, daysUntil: -2, label: "Facture 2026-001 — Acompte" });
  });

  it("ignore brouillons, factures payées ou annulées", () => {
    const due = isoDay(3);
    const out = computeUpcomingPayments([], [], [], [], 60, [], [], [
      invoice({ id: "d", status: "draft", due_date: due }),
      invoice({ id: "p", status: "paid", due_date: due }),
      invoice({ id: "x", status: "cancelled", due_date: due }),
    ]);
    expect(out).toHaveLength(0);
  });

  it("résultat trié par date croissante", () => {
    const p1 = proj({ id: "p1", deadline: isoDay(20) });
    const p2 = proj({ id: "p2", deadline: isoDay(5) });
    const out = computeUpcomingPayments([], [], [], [], 60, [p1, p2], []);
    expect(out.map((o) => o.id)).toEqual(["proj-p2", "proj-p1"]);
  });
});
