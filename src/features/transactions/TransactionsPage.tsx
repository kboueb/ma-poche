import { useEffect, useState, useMemo } from "react";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { formatCurrency } from "@/lib/utils/currency";
import { formatRelative } from "@/lib/utils/dates";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Plus, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Trash2, Check, Upload, Edit2 } from "lucide-react";
import TransactionForm from "./TransactionForm";
import TransactionImport from "./TransactionImport";
import type { Transaction } from "@/types";

const FLOW_OPTIONS = [
  { value: "", label: "Tous les types" },
  { value: "income", label: "Revenus" },
  { value: "expense", label: "Dépenses" },
  { value: "transfer", label: "Virements" },
];

const FLOW_ICON: Record<string, React.ReactNode> = {
  income: <ArrowUpRight className="w-3.5 h-3.5" />,
  expense: <ArrowDownRight className="w-3.5 h-3.5" />,
  transfer: <ArrowLeftRight className="w-3.5 h-3.5" />,
};

const FLOW_COLORS: Record<string, string> = {
  income: "bg-emerald-500/10 text-emerald-400",
  expense: "bg-rose-500/10 text-rose-400",
  transfer: "bg-brand-500/10 text-brand-400",
};

export default function TransactionsPage() {
  const { transactions, loading, fetch, remove, update } = useTransactionsStore();
  const { accounts, fetch: fetchAcc } = useAccountsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [flowFilter, setFlowFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  useEffect(() => { fetch(); fetchAcc(); fetchCat(); }, [fetch, fetchAcc, fetchCat]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (flowFilter && t.flow !== flowFilter) return false;
      if (accountFilter && t.account_id !== accountFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return (t.description?.toLowerCase().includes(s)) || (t.category?.name?.toLowerCase().includes(s));
      }
      return true;
    });
  }, [transactions, flowFilter, accountFilter, search]);

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((t) => {
      const key = t.date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(t);
    });
    return Array.from(map.entries());
  }, [filtered]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const deleteSelected = async () => {
    for (const id of selected) await remove(id);
    setSelected(new Set());
  };

  const markReviewed = async () => {
    for (const id of selected) await update(id, { is_reviewed: true });
    setSelected(new Set());
  };

  const accountOptions = [{ value: "", label: "Tous les comptes" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-text-muted text-sm mt-1">{filtered.length} transaction{filtered.length > 1 ? "s" : ""}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => setImportOpen(true)}>Importer CSV</Button>
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Ajouter</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-4 h-4" />} />
        </div>
        <Select options={FLOW_OPTIONS} value={flowFilter} onChange={(e) => setFlowFilter(e.target.value)} />
        <Select options={accountOptions} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} />
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-brand-500/10 border border-brand-500/20 rounded-xl">
          <span className="text-xs font-medium text-brand-400">{selected.size} sélectionnée(s)</span>
          <Button size="sm" variant="ghost" icon={<Check className="w-3.5 h-3.5" />} onClick={markReviewed}>Révisé</Button>
          <Button size="sm" variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={deleteSelected}>Supprimer</Button>
        </div>
      )}

      {/* Transaction list grouped by date */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-14 bg-surface-1 rounded-xl animate-pulse" />)}
        </div>
      ) : grouped.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted">Aucune transaction trouvée</p>
          <Button variant="secondary" className="mt-4" onClick={() => setFormOpen(true)} icon={<Plus className="w-4 h-4" />}>Ajouter la première</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">{formatRelative(date)}</p>
              <div className="bg-surface-1 border border-surface-3 rounded-2xl divide-y divide-surface-3 overflow-hidden">
                {txs.map((t) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer group ${selected.has(t.id) ? "bg-brand-500/5" : ""}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button.edit-btn")) return;
                      toggleSelect(t.id);
                    }}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${FLOW_COLORS[t.flow]}`}>
                      {FLOW_ICON[t.flow]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.description || "—"}</p>
                      <p className="text-[11px] text-text-muted truncate">
                        {t.category?.name || "Non catégorisé"} · {t.account?.name}
                        {t.is_reviewed && <span className="ml-1 text-emerald-400">✓</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <p className={`text-sm font-mono font-bold ${t.flow === "income" ? "text-emerald-400" : t.flow === "expense" ? "text-rose-400" : "text-brand-400"}`}>
                        {t.flow === "income" ? "+" : t.flow === "expense" ? "-" : ""}{formatCurrency(Number(t.amount))}
                      </p>
                      <button 
                        className="edit-btn p-2 text-text-muted hover:text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingTx(t);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Transaction Modal */}
      <Modal isOpen={formOpen || !!editingTx} onClose={() => { setFormOpen(false); setEditingTx(null); }} title={editingTx ? "Modifier la transaction" : "Nouvelle transaction"}>
        <TransactionForm 
          onClose={() => { 
            setFormOpen(false); 
            if (editingTx) fetch(); // refresh list to get updated related fields
            setEditingTx(null); 
          }} 
          accounts={accounts} 
          categories={categories} 
          initialData={editingTx || undefined}
        />
      </Modal>

      {/* Import CSV Modal */}
      <TransactionImport isOpen={importOpen} onClose={() => setImportOpen(false)} accounts={accounts} />
    </div>
  );
}
