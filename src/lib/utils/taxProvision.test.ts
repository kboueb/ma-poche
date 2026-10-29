import { describe, it, expect } from "vitest";
import { computeTaxProvision, resolveTaxCategoryIds } from "./taxProvision";
import type { Transaction } from "@/types";

const tx = (over: Partial<Transaction>): Transaction => ({
  id: "t", user_id: "u", account_id: "a", category_id: null, amount: 0, flow: "income",
  transfer_to_account_id: null, date: "2026-03-01", description: null, note: null, tags: [],
  recurrence_rule: null, recurrence_parent_id: null, is_reviewed: false, created_at: "",
  ...over,
});

describe("computeTaxProvision", () => {
  const txs = [
    tx({ amount: 1000, project_id: "p1" }),                                       // mission : compte
    tx({ amount: 3000, project_id: null }),                                       // salaire : ne compte pas
    tx({ amount: 500, project_id: "p2", date: "2025-12-31" }),                    // autre année
    tx({ amount: 120, flow: "expense", category_id: "impots" }),                  // impôts payés
    tx({ amount: 80, flow: "expense", category_id: "courses" }),                  // dépense ordinaire
  ];

  it("met de côté un pourcentage du CA de l'année, moins ce qui est déjà payé", () => {
    expect(computeTaxProvision(txs, { rate: 25, taxCategoryIds: ["impots"], year: 2026 })).toEqual({
      revenue: 1000, provisioned: 250, paid: 120, outstanding: 130,
    });
  });

  it("le reste à provisionner ne devient jamais négatif", () => {
    expect(computeTaxProvision(txs, { rate: 10, taxCategoryIds: ["impots"], year: 2026 }).outstanding).toBe(0);
  });

  it("convertit les montants dans la devise principale", () => {
    const eur = [tx({ amount: 10, project_id: "p", account: { currency: "EUR" } as Transaction["account"] })];
    const r = computeTaxProvision(eur, { rate: 50, taxCategoryIds: [], year: 2026, convert: (a, c) => (c === "EUR" ? a * 600 : a) });
    expect(r).toMatchObject({ revenue: 6000, provisioned: 3000 });
  });
});

describe("resolveTaxCategoryIds", () => {
  const cats = [
    { id: "a", name: "Impôts & taxes", flow: "expense" },
    { id: "b", name: "Courses", flow: "expense" },
    { id: "c", name: "Remboursement d'impôt", flow: "income" },
  ];
  it("détecte les catégories d'impôts par leur nom si rien n'est choisi", () => {
    expect(resolveTaxCategoryIds(cats, [])).toEqual(["a"]);
  });
  it("respecte le choix de l'utilisateur", () => {
    expect(resolveTaxCategoryIds(cats, ["b"])).toEqual(["b"]);
  });
});
