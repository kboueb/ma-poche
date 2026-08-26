import type { Account, Transaction } from "@/types";

/**
 * Calcule le solde d'un compte à partir de ses transactions.
 * Prend en compte les revenus, dépenses, virements sortants et virements entrants.
 */
export function computeAccountBalance(
  account: Account,
  transactions: Transaction[]
): number {
  const outTx = transactions.filter((t) => t.account_id === account.id);
  const inTx = transactions.filter((t) => t.transfer_to_account_id === account.id);

  const inc = outTx
    .filter((t) => t.flow === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const exp = outTx
    .filter((t) => t.flow === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const transferOut = outTx
    .filter((t) => t.flow === "transfer")
    .reduce((s, t) => s + Number(t.amount), 0);
  const transferIn = inTx
    .filter((t) => t.flow === "transfer")
    .reduce((s, t) => s + Number(t.amount), 0);

  return Number(account.initial_balance || 0) + inc - exp - transferOut + transferIn;
}

/**
 * Calcule le solde total de tous les comptes (en devise de base).
 */
export function computeTotalBalance(
  accounts: Account[],
  transactions: Transaction[],
  convertToBase: (amount: number, currency: string) => number
): number {
  return accounts.reduce(
    (total, acc) => total + convertToBase(computeAccountBalance(acc, transactions), acc.currency),
    0
  );
}
