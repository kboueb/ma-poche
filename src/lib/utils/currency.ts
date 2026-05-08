import { useSettingsStore } from "@/stores/useSettingsStore";

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

export function getBaseCurrency() {
  try {
    return useSettingsStore.getState().currency || "XOF";
  } catch (e) {
    return "XOF";
  }
}

/** Convertit un montant vers la devise principale de l'utilisateur */
export function convertToBase(amount: number, fromCurrency: string = "XOF"): number {
  const targetCurrency = getBaseCurrency();
  if (fromCurrency === targetCurrency) return amount;
  
  const fromRate = EXCHANGE_RATES[fromCurrency] || 1;
  const targetRate = EXCHANGE_RATES[targetCurrency] || 1;
  
  // fromRate is how many base units (XOF) 1 unit of fromCurrency is worth
  // targetRate is how many base units (XOF) 1 unit of targetCurrency is worth
  return amount * (fromRate / targetRate);
}

/** Format a number as currency string, e.g. 1 234 FCFA */
export function formatCurrency(amount: number, currency?: string): string {
  const targetCurrency = currency || getBaseCurrency();
  const formatted = getFormatter(targetCurrency).format(amount);
  return `${formatted}${CURRENCY_SUFFIX[targetCurrency] || ` ${targetCurrency}`}`;
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
