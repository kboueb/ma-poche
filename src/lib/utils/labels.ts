/** Labels français pour les types de comptes, actifs, passifs, etc. */

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Compte courant",
  savings: "Épargne",
  credit: "Carte de crédit",
  investment: "Investissement",
  cash: "Espèces",
  other: "Autre",
};

export const FLOW_LABELS: Record<string, string> = {
  income: "Revenu",
  expense: "Dépense",
  transfer: "Virement",
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  real_estate: "Immobilier",
  stock: "Actions",
  etf: "ETF",
  crypto: "Crypto",
  savings_account: "Épargne",
  life_insurance: "Assurance vie",
  other: "Autre",
};

export const LIABILITY_TYPE_LABELS: Record<string, string> = {
  mortgage: "Crédit immobilier",
  car_loan: "Crédit auto",
  consumer_credit: "Crédit conso",
  student_loan: "Prêt étudiant",
  other: "Autre",
};

export const BUDGET_PERIOD_LABELS: Record<string, string> = {
  monthly: "Mensuel",
  yearly: "Annuel",
};
