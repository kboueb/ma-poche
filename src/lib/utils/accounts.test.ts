import { describe, it, expect } from "vitest";
import { computeAccountBalance, computeTotalBalance } from "./accounts";
import type { Account, Transaction } from "@/types";

const acc = (over: Partial<Account> = {}): Account => ({
  id: "acc-1",
  user_id: "u",
  name: "Compte",
  type: "checking",
  institution: null,
  initial_balance: 1000,
  current_balance: 0,
  currency: "XOF",
  color: "#fff",
  is_liquid: true,
  created_at: "",
  ...over,
});

const tx = (over: Partial<Transaction> = {}): Transaction => ({
  id: "tx",
  user_id: "u",
  account_id: "acc-1",
  category_id: null,
  amount: 0,
  flow: "expense",
  transfer_to_account_id: null,
  date: "2026-09-01",
  description: null,
  note: null,
  tags: [],
  recurrence_rule: null,
  recurrence_parent_id: null,
  is_reviewed: false,
  created_at: "",
  ...over,
});

describe("computeAccountBalance", () => {
  it("initial + revenus − dépenses − virements sortants + virements entrants", () => {
    const transactions = [
      tx({ id: "1", flow: "income", amount: 500 }),
      tx({ id: "2", flow: "expense", amount: 200 }),
      tx({ id: "3", flow: "transfer", amount: 100, transfer_to_account_id: "acc-2" }),
      tx({ id: "4", account_id: "acc-2", flow: "transfer", amount: 50, transfer_to_account_id: "acc-1" }),
      tx({ id: "5", account_id: "acc-2", flow: "income", amount: 999 }),
    ];
    expect(computeAccountBalance(acc(), transactions)).toBe(1000 + 500 - 200 - 100 + 50);
  });
});

describe("computeTotalBalance", () => {
  it("somme les comptes convertis", () => {
    const accounts = [acc({ id: "a1", initial_balance: 100 }), acc({ id: "a2", initial_balance: 200 })];
    expect(computeTotalBalance(accounts, [], (n) => n)).toBe(300);
  });
});
