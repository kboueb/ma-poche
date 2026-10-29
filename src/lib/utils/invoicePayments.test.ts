import { describe, it, expect } from "vitest";
import { splitByPercent, percentsAreComplete, isPaymentOverdue, summarizePayments } from "./invoicePayments";
import type { InvoicePayment } from "@/types";

const pay = (over: Partial<InvoicePayment> = {}): InvoicePayment => ({
  id: "p",
  user_id: "u",
  invoice_id: "inv",
  label: "Acompte",
  amount_due: 100,
  amount_paid: 0,
  due_date: null,
  paid_date: null,
  status: "pending",
  transaction_id: null,
  created_at: "",
  ...over,
});

describe("splitByPercent", () => {
  it("répartit 50/30/20", () => {
    const r = splitByPercent(1000, [
      { label: "Démarrage", percent: 50, due_date: null },
      { label: "MVP", percent: 30, due_date: null },
      { label: "Mise en ligne", percent: 20, due_date: "2026-12-01" },
    ]);
    expect(r.map((x) => x.amount_due)).toEqual([500, 300, 200]);
    expect(r[2].due_date).toBe("2026-12-01");
  });

  it("tombe juste au centime quand la division ne tombe pas rond", () => {
    const r = splitByPercent(100, [
      { label: "a", percent: 33.33, due_date: null },
      { label: "b", percent: 33.33, due_date: null },
      { label: "c", percent: 33.34, due_date: null },
    ]);
    expect(r.reduce((s, x) => s + Math.round(x.amount_due * 100), 0)).toBe(10000);
  });

  it("une seule échéance prend tout", () => {
    expect(splitByPercent(1234.56, [{ label: "x", percent: 100, due_date: null }])[0].amount_due).toBe(1234.56);
  });
});

describe("percentsAreComplete", () => {
  it("accepte 100 et refuse le reste", () => {
    expect(percentsAreComplete([{ label: "a", percent: 60, due_date: null }, { label: "b", percent: 40, due_date: null }])).toBe(true);
    expect(percentsAreComplete([{ label: "a", percent: 60, due_date: null }])).toBe(false);
  });
});

describe("isPaymentOverdue", () => {
  it("en retard si non payée et échéance passée", () => {
    expect(isPaymentOverdue(pay({ due_date: "2026-01-01" }), "2026-01-02")).toBe(true);
    expect(isPaymentOverdue(pay({ due_date: "2026-01-02" }), "2026-01-02")).toBe(false);
    expect(isPaymentOverdue(pay({ due_date: "2026-01-01", status: "paid" }), "2026-01-02")).toBe(false);
    expect(isPaymentOverdue(pay({ due_date: null }), "2026-01-02")).toBe(false);
  });
});

describe("summarizePayments", () => {
  it("calcule dû, payé, reste et complétude", () => {
    const s = summarizePayments([
      pay({ amount_due: 500, amount_paid: 500, status: "paid" }),
      pay({ amount_due: 300.1, due_date: "2026-01-01" }),
      pay({ amount_due: 199.9 }),
    ], "2026-02-01");
    expect(s).toMatchObject({ due: 1000, paid: 500, remaining: 500, paidCount: 1, count: 3, allPaid: false, overdueCount: 1 });
  });

  it("allPaid seulement si toutes les échéances sont payées", () => {
    expect(summarizePayments([pay({ status: "paid", amount_paid: 100 })], "2026-01-01").allPaid).toBe(true);
    expect(summarizePayments([], "2026-01-01").allPaid).toBe(false);
  });
});
