import { describe, it, expect } from "vitest";
import { computeCashForecast } from "./cashForecast";
import type { UpcomingPayment } from "./upcomingPayments";

const today = new Date(2026, 9, 29); // 29 oct. 2026

const due = (over: Partial<UpcomingPayment>): UpcomingPayment => ({
  id: "x", label: "x", amount: 100, flow: "expense", dueDate: "", daysUntil: 1, source: "recurrence",
  ...over,
});

describe("computeCashForecast", () => {
  it("projette le solde jour par jour sur l'horizon", () => {
    const f = computeCashForecast(1000, [
      due({ id: "loyer", amount: 400, daysUntil: 2 }),
      due({ id: "salaire", amount: 1500, flow: "income", daysUntil: 5 }),
    ], { horizonDays: 7, today });

    expect(f.points).toHaveLength(8);
    expect(f.points[0]).toMatchObject({ date: "2026-10-29", balance: 1000 });
    expect(f.points[2]).toMatchObject({ date: "2026-10-31", balance: 600, expense: 400 });
    expect(f.points[5].balance).toBe(2100);
    expect(f.end).toBe(2100);
    expect(f.lowest.balance).toBe(600);
    expect(f.firstNegative).toBeNull();
  });

  it("repère le premier jour à découvert", () => {
    const f = computeCashForecast(100, [due({ amount: 250, daysUntil: 3 })], { horizonDays: 10, today });
    expect(f.firstNegative).toBe("2026-11-01");
    expect(f.lowest.balance).toBe(-150);
  });

  it("compte les retards aujourd'hui et ignore ce qui dépasse l'horizon", () => {
    const f = computeCashForecast(0, [
      due({ id: "retard", amount: 50, daysUntil: -4 }),
      due({ id: "loin", amount: 999, daysUntil: 40 }),
    ], { horizonDays: 30, today });
    expect(f.points[0].balance).toBe(-50);
    expect(f.totalExpense).toBe(50);
  });

  it("scénario sans encaissement client : ignore factures et jalons, garde le salaire", () => {
    const items = [
      due({ id: "fac", amount: 800, flow: "income", source: "invoice", daysUntil: 1 }),
      due({ id: "jal", amount: 200, flow: "income", source: "milestone", daysUntil: 2 }),
      due({ id: "sal", amount: 300, flow: "income", source: "recurrence", daysUntil: 3 }),
    ];
    expect(computeCashForecast(0, items, { horizonDays: 5, today }).end).toBe(1300);
    expect(computeCashForecast(0, items, { horizonDays: 5, today, withoutClientIncome: true }).end).toBe(300);
  });

  it("ignore les échéances sans montant (dates de mission)", () => {
    const f = computeCashForecast(10, [due({ flow: "none", amount: 0, source: "project" })], { horizonDays: 3, today });
    expect(f.end).toBe(10);
  });
});
