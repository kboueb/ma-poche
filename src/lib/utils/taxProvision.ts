import type { Transaction } from "@/types";

export interface TaxProvision {
  /** Chiffre d'affaires encaissé sur l'année (recettes liées à une mission) */
  revenue: number;
  /** Montant à mettre de côté sur ce chiffre d'affaires */
  provisioned: number;
  /** Impôts et charges déjà payés sur l'année */
  paid: number;
  /** Reste à mettre de côté (jamais négatif) */
  outstanding: number;
}

export interface TaxProvisionOptions {
  /** Taux en % (ex. 25) */
  rate: number;
  /** Catégories de dépenses qui comptent comme impôts ou charges payés */
  taxCategoryIds: string[];
  year: number;
  /** Conversion vers la devise principale (montant, devise du compte) */
  convert?: (amount: number, currency?: string) => number;
}

/**
 * Provision freelance : un pourcentage de chaque encaissement client de l'année,
 * diminué des impôts et charges déjà réglés.
 */
export function computeTaxProvision(
  transactions: Transaction[],
  { rate, taxCategoryIds, year, convert = (a) => a }: TaxProvisionOptions,
): TaxProvision {
  const prefix = `${year}-`;
  let revenue = 0;
  let paid = 0;
  for (const t of transactions) {
    if (!t.date.startsWith(prefix)) continue;
    const amount = convert(Number(t.amount), t.account?.currency);
    if (t.flow === "income" && t.project_id) revenue += amount;
    else if (t.flow === "expense" && t.category_id && taxCategoryIds.includes(t.category_id)) paid += amount;
  }
  const provisioned = Math.round(revenue * Math.max(0, rate)) / 100;
  return { revenue, provisioned, paid, outstanding: Math.max(0, provisioned - paid) };
}

const TAX_NAME = /imp[oô]t|taxe|charges? sociales?|urssaf|cnps|tva/i;

/** Catégories choisies dans les réglages, sinon les catégories de dépenses dont le nom évoque l'impôt. */
export function resolveTaxCategoryIds(
  categories: { id: string; name: string; flow: string }[],
  chosen: string[],
): string[] {
  if (chosen.length > 0) return chosen;
  return categories.filter((c) => c.flow === "expense" && TAX_NAME.test(c.name)).map((c) => c.id);
}
