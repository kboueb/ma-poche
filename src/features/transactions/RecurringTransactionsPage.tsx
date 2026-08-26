import { useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { Repeat, Pause, Play, Trash2, Calendar, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import type { Transaction } from "@/types";

const RECURRENCE_LABELS: Record<string, string> = {
  weekly: "Chaque semaine",
  monthly: "Chaque mois",
  yearly: "Chaque année",
};

export default function RecurringTransactionsPage() {
  const { transactions, fetch: fetchTx, update, remove } = useTransactionsStore();
  const { accounts, fetch: fetchAcc } = useAccountsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();

  useEffect(() => {
    fetchTx();
    fetchAcc();
    fetchCat();
  }, [fetchTx, fetchAcc, fetchCat]);

  const parentTransactions = useMemo(() => {
    return transactions.filter((t) => t.recurrence_rule && !t.recurrence_parent_id);
  }, [transactions]);

  const childCountMap = useMemo(() => {
    const map = new Map<string, number>();
    transactions.forEach((t) => {
      if (t.recurrence_parent_id) {
        map.set(t.recurrence_parent_id, (map.get(t.recurrence_parent_id) || 0) + 1);
      }
    });
    return map;
  }, [transactions]);

  const togglePause = async (tx: Transaction) => {
    const newActive = tx.is_active === false ? true : false;
    await update(tx.id, { is_active: newActive });
    toast.success(newActive ? "Récurrence réactivée" : "Récurrence mise en pause");
  };

  const deleteParent = async (tx: Transaction) => {
    const childIds = transactions
      .filter((t) => t.recurrence_parent_id === tx.id)
      .map((t) => t.id);

    if (childIds.length > 0) {
      await supabase.from("transactions").delete().in("id", childIds);
    }
    await remove(tx.id);
    toast.success(`${childIds.length + 1} transaction${childIds.length > 0 ? "s" : ""} supprimée${childIds.length > 0 ? "s" : ""}`);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Transactions récurrentes</h1>
        <p className="text-text-muted text-sm mt-1">
          {parentTransactions.length} règle{parentTransactions.length !== 1 ? "s" : ""} active{parentTransactions.length !== 1 ? "s" : ""}
          {" · "}
          {parentTransactions.filter((t) => t.is_active === false).length} en pause
        </p>
      </div>

      {parentTransactions.length === 0 ? (
        <div className="text-center py-20 bg-surface-1 border-2 border-dashed border-surface-3 rounded-3xl">
          <Repeat className="w-12 h-12 text-surface-3 mx-auto mb-4" />
          <p className="text-text-muted">Aucune transaction récurrente</p>
          <p className="text-text-muted text-xs mt-1">Créez-en une depuis le formulaire de transaction</p>
        </div>
      ) : (
        <div className="space-y-3">
          {parentTransactions.map((tx) => {
            const isPaused = tx.is_active === false;
            const childCount = childCountMap.get(tx.id) || 0;
            const account = accounts.find((a) => a.id === tx.account_id);
            const category = categories.find((c) => c.id === tx.category_id);

            return (
              <div
                key={tx.id}
                className={`bg-surface-1 border rounded-2xl p-5 transition-all ${
                  isPaused ? "border-surface-4 opacity-60" : "border-surface-3"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isPaused ? "bg-surface-3 text-text-muted" : tx.flow === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  }`}>
                    {tx.flow === "income" ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold truncate">{tx.description || "Sans description"}</p>
                      {isPaused && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
                          <Pause className="w-2.5 h-2.5" /> Pause
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted">
                      <span className="flex items-center gap-1">
                        <Repeat className="w-3 h-3" />
                        {RECURRENCE_LABELS[tx.recurrence_rule || ""] || tx.recurrence_rule}
                      </span>
                      <span>·</span>
                      <span>{category?.name || "Non catégorisé"}</span>
                      <span>·</span>
                      <span>{account?.name || "?"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-text-muted mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>Depuis le {formatDate(tx.date, "d MMMM yyyy")}</span>
                      {childCount > 0 && (
                        <>
                          <span>·</span>
                          <span>{childCount} occurrence{childCount !== 1 ? "s" : ""} générée{childCount !== 1 ? "s" : ""}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-sm font-mono font-bold ${tx.flow === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                      {tx.flow === "income" ? "+" : "-"}{formatCurrency(Number(tx.amount))}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t border-surface-3">
                  <button
                    onClick={() => togglePause(tx)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      isPaused
                        ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                    }`}
                  >
                    {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    {isPaused ? "Reprendre" : "Mettre en pause"}
                  </button>
                  <button
                    onClick={() => deleteParent(tx)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
