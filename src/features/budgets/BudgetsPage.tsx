import { useEffect, useMemo, useState } from "react";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useBudgetsStore } from "@/stores/useBudgetsStore";
import { formatCurrency } from "@/lib/utils/currency";
import { getMonthRange, formatDate } from "@/lib/utils/dates";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Plus, AlertTriangle, Trash2, TrendingUp, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { parseISO, isWithinInterval, getDate, getDaysInMonth, addMonths, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { toast } from "sonner";

function BudgetGauge({ spent, budget, label, color, alert, onRemove, rolloverAmount }: { spent: number; budget: number; label: string; color: string; alert: number; onRemove: () => void; rolloverAmount?: number }) {
  const effectiveBudget = budget + (rolloverAmount || 0);
  const pct = effectiveBudget > 0 ? Math.min((spent / effectiveBudget) * 100, 100) : 0;
  const isOverBudget = pct >= 100;
  const isWarning = pct >= alert;
  const barColor = isOverBudget ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500";

  // Prediction logic
  const today = new Date();
  const dayOfMonth = getDate(today);
  const daysInMonth = getDaysInMonth(today);
  const projected = dayOfMonth > 0 ? (spent / dayOfMonth) * daysInMonth : spent;
  const isProjectedOver = projected > effectiveBudget && effectiveBudget > 0;
  const projectionPct = effectiveBudget > 0 ? (projected / effectiveBudget) * 100 : 0;

  return (
    <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 space-y-3 relative group">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold">{label}</span>
          {rolloverAmount ? rolloverAmount > 0 ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
              <RefreshCw className="w-2.5 h-2.5" /> +{formatCurrency(rolloverAmount)}
            </span>
          ) : null : null}
        </div>
        <div className="flex items-center gap-2">
          {isWarning && <AlertTriangle className="w-4 h-4 text-amber-500" />}
          <button onClick={onRemove} className="p-1 text-text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="h-2.5 bg-surface-3 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <span className={`font-mono font-bold ${isOverBudget ? "text-rose-400" : "text-text-primary"}`}>
          {formatCurrency(spent)}
        </span>
        <span className="text-text-muted">/ {formatCurrency(effectiveBudget)}</span>
      </div>
      <p className="text-[11px] text-text-muted">{pct.toFixed(0)}% utilisé — reste {formatCurrency(Math.max(effectiveBudget - spent, 0))}</p>
      
      {/* Prediction indicator */}
      {effectiveBudget > 0 && !isOverBudget && (
        <div className={`mt-2 p-2 rounded-lg text-[10px] flex items-center gap-2 ${isProjectedOver ? "bg-rose-500/10 text-rose-400" : "bg-emerald-500/10 text-emerald-400"}`}>
          {isProjectedOver ? <AlertTriangle className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
          <span>
            {isProjectedOver 
              ? `Projection : ${projectionPct.toFixed(0)}% (Dépassement probable)` 
              : `Sur la bonne voie pour finir à ${projectionPct.toFixed(0)}%`}
          </span>
        </div>
      )}
    </div>
  );
}

export default function BudgetsPage() {
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();
  const { budgets, loading, fetch: fetchBudgets, add, remove } = useBudgetsStore();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);

  // Form state
  const [formCat, setFormCat] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formRollover, setFormRollover] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTx(); fetchCat(); fetchBudgets(); }, [fetchTx, fetchCat, fetchBudgets]);

  const { start, end } = useMemo(() => getMonthRange(currentDate), [currentDate]);

  const budgetData = useMemo(() => {
    return budgets.map((b) => {
      const spent = transactions
        .filter((t) => t.flow === "expense" && t.category_id === b.category_id && isWithinInterval(parseISO(t.date), { start, end }))
        .reduce((s, t) => s + Number(t.amount), 0);

      let rolloverAmount = 0;
      if (b.rollover) {
        const prevMonth = subMonths(currentDate, 1);
        const prevStart = startOfMonth(prevMonth);
        const prevEnd = endOfMonth(prevMonth);
        const prevSpent = transactions
          .filter((t) => t.flow === "expense" && t.category_id === b.category_id && isWithinInterval(parseISO(t.date), { start: prevStart, end: prevEnd }))
          .reduce((s, t) => s + Number(t.amount), 0);
        rolloverAmount = Math.max(Number(b.amount) - prevSpent, 0);
      }

      return { ...b, spent, rolloverAmount };
    });
  }, [budgets, transactions, start, end, currentDate]);

  const totalBudget = budgetData.reduce((s, b) => s + Number(b.amount), 0);
  const totalSpent = budgetData.reduce((s, b) => s + (b.spent || 0), 0);

  const handleAddBudget = async () => {
    if (!formCat || !formAmount) return;
    setSaving(true);
    await add({
      category_id: formCat,
      amount: parseFloat(formAmount),
      period: "monthly",
      active_from: start.toISOString().slice(0, 10),
      active_to: null,
      rollover: formRollover,
      alert_threshold: 80,
    });
    setSaving(false);
    setFormOpen(false);
    setFormCat("");
    setFormAmount("");
    setFormRollover(false);
  };

  const expenseCategories = categories.filter((c) => c.flow === "expense" || c.flow === "both");

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-text-muted text-sm mt-1">Gérez vos limites de dépenses</p>
        </div>
        
        <div className="flex items-center gap-2 bg-surface-1 border border-surface-3 rounded-xl p-1 shrink-0 w-fit">
          <button 
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors text-text-muted hover:text-text-primary"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold min-w-[110px] text-center capitalize">
            {formatDate(currentDate, "MMMM yyyy")}
          </span>
          <button 
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors text-text-muted hover:text-text-primary"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Nouveau budget</Button>
      </div>

      <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 flex items-center gap-6">
        <div className="flex-1">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Dépensé ce mois</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(totalSpent)} <span className="text-sm text-text-muted font-sans">/ {formatCurrency(totalBudget)}</span></p>
        </div>
        <div className="w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" stroke="var(--surface-3)" strokeWidth="3" fill="none" />
            <circle cx="18" cy="18" r="15" stroke={totalSpent > totalBudget ? "#f43f5e" : "#10b981"} strokeWidth="3" fill="none"
              strokeDasharray={`${Math.min((totalSpent / (totalBudget || 1)) * 94, 94)} 94`} strokeLinecap="round"
              className="transition-all duration-700" />
          </svg>
        </div>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 bg-surface-1 rounded-2xl animate-pulse" />)}
        </div>
      ) : budgetData.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <p>Aucun budget configuré</p>
          <Button variant="secondary" className="mt-4" onClick={() => setFormOpen(true)} icon={<Plus className="w-4 h-4" />}>Créer un budget</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {budgetData.map((b) => (
            <BudgetGauge 
              key={b.id} 
              spent={b.spent || 0} 
              budget={b.amount} 
              label={b.category?.name || "Catégorie"} 
              color={b.category?.color || "#94a3b8"} 
              alert={b.alert_threshold}
              rolloverAmount={b.rollover ? b.rolloverAmount : 0}
              onRemove={() => { remove(b.id); toast.success("Budget supprimé"); }}
            />
          ))}
        </div>
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Nouveau budget" size="sm">
        <div className="space-y-4">
          <Select label="Catégorie" options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))} value={formCat} onChange={(e) => setFormCat(e.target.value)} placeholder="Choisir..." />
          <Input label="Montant mensuel" type="number" step="1" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="500" />
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className={`w-10 h-5 rounded-full relative transition-colors ${formRollover ? "bg-brand-500" : "bg-surface-3"}`}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${formRollover ? "translate-x-5" : "translate-x-0.5"}`} />
            </div>
            <div>
              <span className="text-sm font-medium group-hover:text-text-primary">Rollover</span>
              <p className="text-[11px] text-text-muted">Reporter le reste non utilisé au mois suivant</p>
            </div>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={handleAddBudget}>Créer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

