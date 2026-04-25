import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { formatCurrency } from "@/lib/utils/currency";
import { getMonthRange, formatDate } from "@/lib/utils/dates";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Plus, AlertTriangle } from "lucide-react";
import { parseISO, isWithinInterval } from "date-fns";
import type { Budget } from "@/types";

function BudgetGauge({ spent, budget, label, color, alert }: { spent: number; budget: number; label: string; color: string; alert: number }) {
  const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
  const isOverBudget = pct >= 100;
  const isWarning = pct >= alert;
  const barColor = isOverBudget ? "bg-rose-500" : isWarning ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-sm font-semibold">{label}</span>
        </div>
        {isWarning && <AlertTriangle className="w-4 h-4 text-amber-500" />}
      </div>
      <div className="h-2.5 bg-surface-3 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs">
        <span className={`font-mono font-bold ${isOverBudget ? "text-rose-400" : "text-text-primary"}`}>
          {formatCurrency(spent)}
        </span>
        <span className="text-text-muted">/ {formatCurrency(budget)}</span>
      </div>
      <p className="text-[11px] text-text-muted">{pct.toFixed(0)}% utilisé — reste {formatCurrency(Math.max(budget - spent, 0))}</p>
    </div>
  );
}

export default function BudgetsPage() {
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  // Form state
  const [formCat, setFormCat] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formPeriod, setFormPeriod] = useState<"monthly" | "yearly">("monthly");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchTx(); fetchCat(); loadBudgets(); }, [fetchTx, fetchCat]);

  const loadBudgets = async () => {
    const { data } = await supabase.from("budgets").select("*, category:categories(*)").order("created_at");
    setBudgets((data as Budget[]) || []);
    setLoading(false);
  };

  const { start, end } = getMonthRange();

  const budgetData = useMemo(() => {
    return budgets.map((b) => {
      const spent = transactions
        .filter((t) => t.flow === "expense" && t.category_id === b.category_id && isWithinInterval(parseISO(t.date), { start, end }))
        .reduce((s, t) => s + Number(t.amount), 0);
      return { ...b, spent };
    });
  }, [budgets, transactions, start, end]);

  const totalBudget = budgetData.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgetData.reduce((s, b) => s + (b.spent || 0), 0);

  const addBudget = async () => {
    if (!formCat || !formAmount) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("budgets").insert({
      user_id: user.id,
      category_id: formCat,
      amount: parseFloat(formAmount),
      period: formPeriod,
      active_from: start.toISOString().slice(0, 10),
    });
    await loadBudgets();
    setSaving(false);
    setFormOpen(false);
    setFormCat("");
    setFormAmount("");
  };

  const expenseCategories = categories.filter((c) => c.flow === "expense" || c.flow === "both");

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Budgets</h1>
          <p className="text-text-muted text-sm mt-1">{formatDate(new Date(), "MMMM yyyy")}</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Nouveau budget</Button>
      </div>

      {/* Summary */}
      <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 flex items-center gap-6">
        <div className="flex-1">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1">Dépensé ce mois</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(totalSpent)} <span className="text-sm text-text-muted font-sans">/ {formatCurrency(totalBudget)}</span></p>
        </div>
        <div className="w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15" stroke="var(--surface-3)" strokeWidth="3" fill="none" />
            <circle cx="18" cy="18" r="15" stroke={totalSpent > totalBudget ? "#f43f5e" : "#10b981"} strokeWidth="3" fill="none"
              strokeDasharray={`${Math.min((totalSpent / totalBudget) * 94, 94)} 94`} strokeLinecap="round"
              className="transition-all duration-700" />
          </svg>
        </div>
      </div>

      {/* Budget cards */}
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
            <BudgetGauge key={b.id} spent={b.spent || 0} budget={b.amount} label={b.category?.name || "Catégorie"} color={b.category?.color || "#94a3b8"} alert={b.alert_threshold} />
          ))}
        </div>
      )}

      {/* Add modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Nouveau budget" size="sm">
        <div className="space-y-4">
          <Select label="Catégorie" options={expenseCategories.map((c) => ({ value: c.id, label: c.name }))} value={formCat} onChange={(e) => setFormCat(e.target.value)} placeholder="Choisir..." />
          <Input label="Montant mensuel" type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="500" />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={addBudget}>Créer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
