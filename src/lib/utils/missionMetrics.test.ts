import { describe, it, expect } from "vitest";
import {
  billingModeOf, budgetDays, budgetStatus, clientStats, effectiveDailyRate, expectedRevenue, isQuoteExpired,
  missionFromQuote, missionReview, monthlyBillingCandidates, nextDocNumber, nextMonths, previousMonth,
  quoteTotals, soldDailyRate, templateMilestones, timeBillingLine, workloadByMonth,
} from "./missionMetrics";
import type { Invoice, Project, TimeEntry, Transaction } from "@/types";

const project = (over: Partial<Project> = {}): Project => ({
  id: "p1", user_id: "u", client_id: "c1", client_name: "ACME", name: "Audit", description: null,
  status: "active", billing_mode: null, total_amount: null, hourly_rate: null, daily_rate: null,
  budget_days: null, recurring_monthly: false, start_date: null, deadline: null, color: "#000", notes: null,
  created_at: "",
  ...over,
});

const entry = (over: Partial<TimeEntry> = {}): TimeEntry => ({
  id: "e", user_id: "u", task_id: null, project_id: "p1", invoice_id: null, description: null,
  started_at: "2026-10-01T09:00:00Z", ended_at: "2026-10-01T16:00:00Z", duration_minutes: null, billable: true,
  created_at: "",
  ...over,
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: "t", user_id: "u", account_id: "a", category_id: null, amount: 0, flow: "income",
  transfer_to_account_id: null, date: "2026-03-01", description: null, note: null, tags: [],
  recurrence_rule: null, recurrence_parent_id: null, is_reviewed: false, created_at: "",
  ...over,
});

describe("mode de facturation et budget", () => {
  it("déduit le mode des anciennes missions sans billing_mode", () => {
    expect(billingModeOf(project({ hourly_rate: 80 }))).toBe("hourly");
    expect(billingModeOf(project({ total_amount: 5000, hourly_rate: 80 }))).toBe("fixed");
    expect(billingModeOf(project({ daily_rate: 600 }))).toBe("daily");
  });

  it("budget en jours : saisi, sinon forfait / TJM", () => {
    expect(budgetDays(project({ budget_days: 10, total_amount: 9000, daily_rate: 600 }))).toBe(10);
    expect(budgetDays(project({ total_amount: 6000, daily_rate: 600 }))).toBe(10);
    expect(budgetDays(project({ total_amount: 7000, hourly_rate: 100 }))).toBe(10);
    expect(budgetDays(project({ total_amount: 7000 }))).toBeNull();
  });

  it("montant attendu selon le mode", () => {
    expect(expectedRevenue(project({ billing_mode: "daily", daily_rate: 500, budget_days: 12 }))).toBe(6000);
    expect(expectedRevenue(project({ billing_mode: "hourly", hourly_rate: 50, budget_days: 2 }))).toBe(700);
    expect(expectedRevenue(project({ billing_mode: "fixed", total_amount: 3000 }))).toBe(3000);
  });

  it("TJM vendu et TJM réel", () => {
    expect(soldDailyRate(project({ total_amount: 6000, budget_days: 10 }))).toBe(600);
    expect(soldDailyRate(project({ hourly_rate: 100 }))).toBe(700);
    expect(effectiveDailyRate(6000, 15 * 7 * 60)).toBe(400);
    expect(effectiveDailyRate(6000, 0)).toBeNull();
  });

  it("alerte à 80 % puis dépassement", () => {
    const p = project({ budget_days: 10 });
    expect(budgetStatus(p, 5 * 7 * 60)).toMatchObject({ pct: 50, level: "ok", remainingDays: 5 });
    expect(budgetStatus(p, 8 * 7 * 60)?.level).toBe("warning");
    expect(budgetStatus(p, 11 * 7 * 60)).toMatchObject({ level: "over", remainingDays: 0 });
    expect(budgetStatus(project({ budget_days: 5, recurring_monthly: true }), 60)).toBeNull();
  });
});

describe("timeBillingLine", () => {
  it("facture au jour pour une mission au TJM", () => {
    const l = timeBillingLine(project({ billing_mode: "daily", daily_rate: 600 }), 10.5 * 60);
    expect(l).toMatchObject({ quantity: 1.5, unit_price: 600 });
    expect(l?.label).toContain("1,5 j");
  });

  it("facture à l'heure sinon, et rien sans taux", () => {
    expect(timeBillingLine(project({ hourly_rate: 80 }), 90)).toMatchObject({ quantity: 1.5, unit_price: 80 });
    expect(timeBillingLine(project(), 90)).toBeNull();
    expect(timeBillingLine(project({ hourly_rate: 80 }), 0)).toBeNull();
  });
});

describe("missionReview", () => {
  it("compare le prévu et le réel", () => {
    const p = project({ billing_mode: "daily", daily_rate: 600, budget_days: 10, deadline: "2026-10-10" });
    const r = missionReview(p, {
      income: 6000, expense: 200, minutes: 12 * 7 * 60, milestones: [],
      entries: [entry({ ended_at: "2026-10-13T16:00:00Z" })],
    });
    expect(r).toMatchObject({
      plannedDays: 10, spentDays: 12, daysDelta: 2, expected: 6000, margin: 5800,
      soldRate: 600, effectiveRate: 500, rateDelta: -100, finishedOn: "2026-10-13", lateDays: 3,
    });
  });
});

describe("workloadByMonth", () => {
  it("répartit les jours restants au prorata jusqu'à l'échéance", () => {
    const p = project({ budget_days: 20, start_date: "2026-10-01", deadline: "2026-11-30" });
    const loads = workloadByMonth([p], [], nextMonths("2026-11-01", 2), "2026-11-01");
    expect(loads[0]).toMatchObject({ month: "2026-11", days: 20 });
    expect(loads[1].days).toBe(0);
  });

  it("déduit le temps déjà passé et coupe entre deux mois", () => {
    const p = project({ budget_days: 11, deadline: "2026-11-30" });
    const loads = workloadByMonth([p], [entry()], ["2026-10", "2026-11"], "2026-10-31");
    // 10 jours restants sur 31 j (31 oct → 30 nov) : 1 jour en octobre, 30 en novembre
    expect(loads[0].days).toBeCloseTo(10 / 31, 2);
    expect(loads[1].days).toBeCloseTo(300 / 31, 2);
  });

  it("régie : jours par mois, et ignore les missions non actives", () => {
    const regie = project({ recurring_monthly: true, budget_days: 8, start_date: "2026-11-15" });
    const done = project({ id: "p2", status: "done", budget_days: 5, deadline: "2026-12-01" });
    const loads = workloadByMonth([regie, done], [], ["2026-10", "2026-11", "2026-12"], "2026-10-01");
    expect(loads.map((l) => l.days)).toEqual([0, 8, 8]);
  });
});

describe("clientStats", () => {
  const inv = (over: Partial<Invoice>): Invoice => ({
    id: "i", user_id: "u", project_id: "p1", number: "2026-001", status: "sent", issue_date: "2026-09-01",
    due_date: "2026-10-01", vat_rate: 20, notes: null, issuer_name: null, issuer_details: null, client_details: null,
    payment_terms: null, transaction_id: null, paid_at: null, created_at: "",
    items: [{ id: "x", user_id: "u", invoice_id: "i", label: "L", quantity: 1, unit_price: 1000, kind: "other", position: 0, created_at: "" }],
    payments: [],
    ...over,
  });

  it("agrège CA, encours et délai moyen de paiement", () => {
    const s = clientStats(
      "c1",
      [project(), project({ id: "p2", client_id: "c2" })],
      [inv({}), inv({ id: "i2", status: "paid", issue_date: "2026-06-01", paid_at: "2026-07-01T10:00:00Z" })],
      [tx({ amount: 1200, project_id: "p1" }), tx({ amount: 999, project_id: "p2" })],
      "2026-10-15",
    );
    expect(s).toEqual({
      projectCount: 1, activeCount: 1, revenue: 1200, outstanding: 1200, avgPaymentDays: 30, lateInvoices: 1,
    });
  });
});

describe("devis", () => {
  it("totaux et numérotation", () => {
    expect(quoteTotals([{ quantity: 2, unit_price: 500 }], 20)).toEqual({ ht: 1000, tva: 200, ttc: 1200 });
    expect(nextDocNumber("D", 2026, "D-2026-009")).toBe("D-2026-010");
    expect(nextDocNumber("D", 2026, null)).toBe("D-2026-001");
  });

  it("un devis envoyé expire après sa date de validité", () => {
    expect(isQuoteExpired({ status: "sent", valid_until: "2026-10-01" }, "2026-10-02")).toBe(true);
    expect(isQuoteExpired({ status: "accepted", valid_until: "2026-10-01" }, "2026-10-02")).toBe(false);
  });

  it("convertit un devis au jour en mission au TJM", () => {
    expect(missionFromQuote({ title: "T", vat_rate: 20 }, [
      { quantity: 5, unit_price: 600, unit: "jour" },
      { quantity: 5, unit_price: 500, unit: "j" },
    ])).toEqual({ billing_mode: "daily", total_amount: 5500, daily_rate: 550, hourly_rate: null, budget_days: 10 });
  });

  it("devis mixte → forfait, en gardant les jours vendus comme budget", () => {
    expect(missionFromQuote({ title: "T", vat_rate: 0 }, [
      { quantity: 4, unit_price: 600, unit: "jour" },
      { quantity: 1, unit_price: 300, unit: "forfait" },
    ])).toEqual({ billing_mode: "fixed", total_amount: 2700, daily_rate: 600, hourly_rate: null, budget_days: 4 });
  });
});

describe("modèles et régie", () => {
  it("date et chiffre les jalons d'un modèle", () => {
    expect(templateMilestones({
      milestones: [
        { title: "Acompte", kind: "payment", offset_days: 0, amount_percent: 30 },
        { title: "Recette", kind: "validation", offset_days: 31, amount_percent: null },
      ],
    }, "2026-10-01", 10000)).toEqual([
      { title: "Acompte", kind: "payment", due_date: "2026-10-01", amount: 3000 },
      { title: "Recette", kind: "validation", due_date: "2026-11-01", amount: null },
    ]);
  });

  it("liste les missions en régie à facturer pour le mois", () => {
    const regie = project({ recurring_monthly: true, billing_mode: "daily", daily_rate: 700 });
    const c = monthlyBillingCandidates([regie, project({ id: "p2" })], [
      entry({ id: "a" }),
      entry({ id: "b", invoice_id: "deja" }),
      entry({ id: "c", billable: false }),
      entry({ id: "d", started_at: "2026-09-30T09:00:00Z", ended_at: "2026-09-30T16:00:00Z" }),
      entry({ id: "e", project_id: "p2" }),
    ], "2026-10");
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ entryIds: ["a"], minutes: 420, line: { quantity: 1, unit_price: 700 } });
  });

  it("mois précédent, y compris en janvier", () => {
    expect(previousMonth("2026-01-15")).toBe("2025-12");
    expect(previousMonth("2026-10-29")).toBe("2026-09");
  });
});
