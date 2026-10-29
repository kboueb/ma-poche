import type { InvoicePayment } from "@/types";

export interface PaymentTerm {
  label: string;
  percent: number;
  due_date: string | null;
}

const toCents = (n: number) => Math.round(n * 100);

/** Répartit un total TTC selon des pourcentages, au centime près : la dernière échéance absorbe l'arrondi. */
export function splitByPercent(total: number, terms: PaymentTerm[]): Array<{ label: string; amount_due: number; due_date: string | null }> {
  const totalCents = toCents(total);
  let allocated = 0;
  return terms.map((t, i) => {
    const cents = i === terms.length - 1 ? totalCents - allocated : Math.round((totalCents * t.percent) / 100);
    allocated += cents;
    return { label: t.label, amount_due: cents / 100, due_date: t.due_date };
  });
}

/** Vrai si la somme des pourcentages fait 100 (à 0,01 près). */
export function percentsAreComplete(terms: PaymentTerm[]): boolean {
  return Math.abs(terms.reduce((s, t) => s + t.percent, 0) - 100) < 0.01;
}

export function isPaymentOverdue(p: Pick<InvoicePayment, "status" | "due_date">, today: string): boolean {
  return p.status !== "paid" && !!p.due_date && p.due_date < today;
}

export interface PaymentsSummary {
  due: number;
  paid: number;
  remaining: number;
  paidCount: number;
  count: number;
  allPaid: boolean;
  overdueCount: number;
}

export function summarizePayments(payments: InvoicePayment[], today: string): PaymentsSummary {
  const dueCents = payments.reduce((s, p) => s + toCents(Number(p.amount_due)), 0);
  const paidCents = payments.reduce((s, p) => s + toCents(Number(p.amount_paid)), 0);
  const paidCount = payments.filter((p) => p.status === "paid").length;
  return {
    due: dueCents / 100,
    paid: paidCents / 100,
    remaining: (dueCents - paidCents) / 100,
    paidCount,
    count: payments.length,
    allPaid: payments.length > 0 && paidCount === payments.length,
    overdueCount: payments.filter((p) => isPaymentOverdue(p, today)).length,
  };
}
