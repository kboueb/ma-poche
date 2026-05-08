const formatters = new Map<string, Intl.NumberFormat>();

function getFormatter(currency: string): Intl.NumberFormat {
  if (!formatters.has(currency)) {
    const isXOF = currency === "XOF";
    formatters.set(
      currency,
      new Intl.NumberFormat("fr-FR", {
        style: "decimal",
        minimumFractionDigits: isXOF ? 0 : 2,
        maximumFractionDigits: isXOF ? 0 : 2,
      })
    );
  }
  return formatters.get(currency)!;
}

const CURRENCY_SUFFIX: Record<string, string> = {
  XOF: " FCFA",
  EUR: " €",
  USD: " $",
  GBP: " £",
};

const EXCHANGE_RATES: Record<string, number> = {
  XOF: 1,
  EUR: 655.957,
  USD: 605.0, // Taux approximatif (à rendre dynamique plus tard si besoin)
  GBP: 760.0,
};

export const BASE_CURRENCY = "XOF";

/** Convertit un montant vers la devise de base (XOF) */
export function convertToBase(amount: number, fromCurrency: string = "XOF"): number {
  if (fromCurrency === BASE_CURRENCY) return amount;
  const rate = EXCHANGE_RATES[fromCurrency] || 1;
  return amount * rate;
}

/** Format a number as currency string, e.g. 1 234 FCFA */
export function formatCurrency(amount: number, currency = "XOF"): string {
  const formatted = getFormatter(currency).format(amount);
  return `${formatted}${CURRENCY_SUFFIX[currency] || ` ${currency}`}`;
}

/** Format as compact, e.g. 1,2k or 1,5M */
export function formatCompact(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

/** Format percentage, e.g. +12,5% */
export function formatPercent(value: number, signed = false): string {
  const s = new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
  return signed && value > 0 ? `+${s}` : s;
}
