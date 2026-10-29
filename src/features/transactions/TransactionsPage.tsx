import { useEffect, useState, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { formatCurrency, convertToBase } from "@/lib/utils/currency";
import { formatRelative } from "@/lib/utils/dates";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { Plus, Search, ArrowUpRight, ArrowDownRight, ArrowLeftRight, Trash2, Check, Upload, Edit2, Repeat, Tag, X, Paperclip, Briefcase } from "lucide-react";
import TransactionForm from "./TransactionForm";
import TransactionImport from "./TransactionImport";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { getAttachmentCounts } from "@/lib/services/attachmentService";
import type { Transaction } from "@/types";

const FLOW_OPTIONS = [
  { value: "", label: "Tous les types" },
  { value: "income", label: "Revenus" },
  { value: "expense", label: "Dépenses" },
  { value: "transfer", label: "Virements" },
];

const RECURRENCE_FILTER = [
  { value: "", label: "Toutes" },
  { value: "recurring", label: "Récurrentes" },
  { value: "one-time", label: "Ponctuelles" },
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
  const { projects, fetch: fetchProjects } = useProjectsStore();
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [flowFilter, setFlowFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [recurrenceFilter, setRecurrenceFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [attachmentCounts, setAttachmentCounts] = useState<Map<string, number>>(new Map());

  useEffect(() => { fetch(); fetchAcc(); fetchCat(); fetchProjects(); }, [fetch, fetchAcc, fetchCat, fetchProjects]);

  // Compteurs de justificatifs (1 seule requête pour toute la liste)
  useEffect(() => {
    if (transactions.length === 0) { setAttachmentCounts(new Map()); return; }
    getAttachmentCounts(transactions.map((t) => t.id))
      .then(setAttachmentCounts)
      .catch(() => {});
  }, [transactions]);

  // Highlight depuis la palette ⌘K : scroll + anneau temporaire
  useEffect(() => {
    if (!highlightId || transactions.length === 0) return;
    const el = rowRefs.current.get(highlightId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      const t = setTimeout(() => {
        setSearchParams({}, { replace: true });
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [highlightId, transactions, setSearchParams]);

  // Collect all unique tags from transactions
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    transactions.forEach((t) => t.tags?.forEach((tag) => tagSet.add(tag)));
    return Array.from(tagSet).sort();
  }, [transactions]);

  // Recent descriptions for Quick-Add
  const recentDescriptions = useMemo(() => {
    const seen = new Set<string>();
    const descs: string[] = [];
    for (const t of transactions) {
      if (t.description && !seen.has(t.description)) {
        seen.add(t.description);
        descs.push(t.description);
        if (descs.length >= 8) break;
      }
    }
    return descs;
  }, [transactions]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (flowFilter && t.flow !== flowFilter) return false;
      if (accountFilter && t.account_id !== accountFilter) return false;
      if (recurrenceFilter === "recurring" && !t.recurrence_rule) return false;
      if (recurrenceFilter === "one-time" && t.recurrence_rule) return false;
      if (tagFilter && !t.tags?.includes(tagFilter)) return false;
      if (search) {
        const s = search.toLowerCase();
        return (t.description?.toLowerCase().includes(s)) || (t.category?.name?.toLowerCase().includes(s)) || (t.tags?.some((tag) => tag.toLowerCase().includes(s)));
      }
      return true;
    });
  }, [transactions, flowFilter, accountFilter, recurrenceFilter, tagFilter, search]);

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
      <PageHeader
        title="Transactions"
        subtitle={`${filtered.length} transaction${filtered.length > 1 ? "s" : ""}`}
        actions={
          <>
            <Button variant="secondary" icon={<Upload className="w-4 h-4" />} onClick={() => setImportOpen(true)}>Importer CSV</Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Ajouter</Button>
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} icon={<Search className="w-4 h-4" />} />
        </div>
        <Select options={FLOW_OPTIONS} value={flowFilter} onChange={(e) => setFlowFilter(e.target.value)} />
        <Select options={accountOptions} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} />
        <Select options={RECURRENCE_FILTER} value={recurrenceFilter} onChange={(e) => setRecurrenceFilter(e.target.value)} />
      </div>

      {/* Tag filter chips */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagFilter && (
            <button onClick={() => setTagFilter("")} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-lg">
              <Tag className="w-3 h-3" /> {tagFilter} <X className="w-3 h-3" />
            </button>
          )}
          {allTags.filter((t) => t !== tagFilter).slice(0, 10).map((tag) => (
            <button key={tag} onClick={() => setTagFilter(tag)} className="px-2.5 py-1 text-[11px] font-medium bg-surface-2 hover:bg-surface-3 border border-surface-4 rounded-lg text-text-secondary transition-colors">
              {tag}
            </button>
          ))}
        </div>
      )}

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
        <SkeletonList rows={8} />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight className="w-12 h-12" />}
          title="Aucune transaction trouvée"
          description="Ajoutez votre première transaction ou modifiez les filtres."
          actionLabel="Ajouter la première"
          onAction={() => setFormOpen(true)}
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, txs]) => (
            <div key={date}>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1">{formatRelative(date)}</p>
              <div className="bg-surface-1 border border-surface-3 rounded-2xl divide-y divide-surface-3 overflow-hidden">
                {txs.map((t) => (
                  <div
                    key={t.id}
                    ref={(el) => { if (el) rowRefs.current.set(t.id, el); else rowRefs.current.delete(t.id); }}
                    className={`flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors cursor-pointer group ${selected.has(t.id) ? "bg-brand-500/5" : ""} ${highlightId === t.id ? "ring-2 ring-brand-500 bg-brand-500/10 rounded-xl" : ""}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button.edit-btn")) return;
                      toggleSelect(t.id);
                    }}
                  >
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${FLOW_COLORS[t.flow]}`}>
                      {FLOW_ICON[t.flow]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">
                        {t.description || "—"}
                        {t.recurrence_rule && <Repeat className="w-3 h-3 text-brand-400 shrink-0" />}
                        {t.project_id && (() => {
                          const proj = projects.find((p) => p.id === t.project_id);
                          return proj ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded shrink-0 truncate max-w-[140px]" title={`${proj.client_name} — ${proj.name}`}>
                              <Briefcase className="w-2.5 h-2.5 shrink-0" />{proj.name}
                            </span>
                          ) : null;
                        })()}
                        {(attachmentCounts.get(t.id) || 0) > 0 && (
                          <button
                            className="edit-btn inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-medium bg-surface-3 hover:bg-brand-500/20 hover:text-brand-400 rounded text-text-muted transition-colors shrink-0"
                            title="Voir les justificatifs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTx(t);
                            }}
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            {attachmentCounts.get(t.id)}
                          </button>
                        )}
                      </p>
                      <p className="text-[11px] text-text-muted truncate">
                        {t.category?.name || "Non catégorisé"} · {t.account?.name}
                        {t.is_reviewed && <Check className="w-3 h-3 ml-1 text-emerald-400 inline" />}
                      </p>
                      {t.tags && t.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {t.tags.map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 text-[9px] font-medium bg-surface-3 rounded text-text-muted">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <p className={`text-sm font-mono font-bold ${t.flow === "income" ? "text-emerald-400" : t.flow === "expense" ? "text-rose-400" : "text-brand-400"}`}>
                        {t.flow === "income" ? "+" : t.flow === "expense" ? "-" : ""}{formatCurrency(convertToBase(Number(t.amount), t.account?.currency))}
                      </p>
                      <button 
                        className="edit-btn p-2 text-text-muted hover:text-brand-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
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
            if (editingTx) fetch();
            setEditingTx(null); 
          }} 
          accounts={accounts} 
          categories={categories} 
          initialData={editingTx || undefined}
          recentDescriptions={recentDescriptions}
        />
      </Modal>

      {/* Import CSV Modal */}
      <TransactionImport isOpen={importOpen} onClose={() => setImportOpen(false)} accounts={accounts} />
    </div>
  );
}
