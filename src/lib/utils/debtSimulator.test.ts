import { describe, it, expect } from "vitest";
import { simulatePayoff } from "./debtSimulator";

describe("simulatePayoff", () => {
  it("dette unique sans intérêts : durée exacte, coût = capital", () => {
    const r = simulatePayoff(
      [{ id: "1", name: "A", balance: 1200, rate: 0, minPayment: 100 }],
      0,
      "avalanche"
    );
    expect(r.months).toBe(12);
    expect(r.totalInterest).toBeCloseTo(0, 6);
    expect(r.totalPaid).toBeCloseTo(1200, 2);
    expect(r.curve[0].remaining).toBe(1200);
    expect(r.curve[r.curve.length - 1].remaining).toBeLessThanOrEqual(0.01);
  });

  it("avalanche coûte moins cher que snowball sur taux contrastés", () => {
    const debts = [
      { id: "1", name: "Petit taux fort", balance: 1000, rate: 20, minPayment: 50 },
      { id: "2", name: "Gros taux faible", balance: 5000, rate: 5, minPayment: 100 },
    ];
    const snow = simulatePayoff(debts, 200, "snowball");
    const ava = simulatePayoff(debts, 200, "avalanche");
    expect(ava.totalInterest).toBeLessThanOrEqual(snow.totalInterest);
    expect(ava.months).toBeGreaterThan(0);
    expect(snow.months).toBeGreaterThan(0);
  });

  it("effort supplémentaire réduit la durée", () => {
    const debts = [{ id: "1", name: "A", balance: 3000, rate: 10, minPayment: 100 }];
    const sans = simulatePayoff(debts, 0, "snowball");
    const avec = simulatePayoff(debts, 200, "snowball");
    expect(avec.months).toBeLessThan(sans.months);
    expect(avec.totalInterest).toBeLessThan(sans.totalInterest);
  });
});
