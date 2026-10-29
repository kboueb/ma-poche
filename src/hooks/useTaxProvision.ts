import { useMemo } from "react";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { convertToBase } from "@/lib/utils/currency";
import { computeTaxProvision, resolveTaxCategoryIds, type TaxProvision } from "@/lib/utils/taxProvision";

/** Provision impôts & charges de l'année en cours, ou null si elle est désactivée (taux 0). */
export function useTaxProvision(): (TaxProvision & { rate: number }) | null {
  const transactions = useTransactionsStore((s) => s.transactions);
  const categories = useCategoriesStore((s) => s.categories);
  const rate = useSettingsStore((s) => s.provisionRate);
  const chosen = useSettingsStore((s) => s.provisionCategoryIds);
  const currency = useSettingsStore((s) => s.currency);

  return useMemo(() => {
    if (!rate) return null;
    const p = computeTaxProvision(transactions, {
      rate,
      taxCategoryIds: resolveTaxCategoryIds(categories, chosen),
      year: new Date().getFullYear(),
      convert: convertToBase,
    });
    return { ...p, rate };
    // currency : convertToBase dépend de la devise principale
  }, [transactions, categories, rate, chosen, currency]);
}
