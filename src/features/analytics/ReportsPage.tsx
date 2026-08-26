import { useEffect, useMemo, useState } from "react";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { formatCurrency, convertToBase } from "@/lib/utils/currency";
import { getMonthRange, format, subMonths } from "@/lib/utils/dates";
import { ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Scale } from "lucide-react";
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Legend } from "recharts";
import { parseISO, isWithinInterval } from "date-fns";
import { fr } from "date-fns/locale";
import type { Transaction } from "@/types";

const CAT_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#3b82f6", "#06b6d4", "#ec4899", "#94a3b8"];

interface MonthSummary {
  label: string;
  income: number;
  expenses: number;
  savings: number;
  savingsRate: number;
  topCategories: Array<{ name: string; value: number }>;
}

function computeMonthSummary(
  transactions: Transaction[],
  date: Date,
): MonthSummary {
  const { start, end } = getMonthRange(date);
  const monthTx = transactions.filter((t) => {
    const d = parseISO(t.date);
    return isWithinInterval(d, { start, end });
  });

  const income = monthTx
    .filter((t) => t.flow === "income")
    .reduce((s, t) => s + convertToBase(Number(t.amount), t.account?.currency), 0);
  const expenses = monthTx
    .filter((t) => t.flow === "expense")
    .reduce((s, t) => s + convertToBase(Number(t.amount), t.account?.currency), 0);
  const savings = income - expenses;
  const savingsRate = income > 0 ? (savings / income) * 100 : 0;

  const catMap = new Map<string, number>();
  monthTx
    .filter((t) => t.flow === "expense")
    .forEach((t) => {
      const name = t.category?.name || "Autre";
      catMap.set(name, (catMap.get(name) || 0) + convertToBase(Number(t.amount), t.account?.currency));
    });
  const topCategories = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return {
    label: format(date, "MMMM yyyy", { locale: fr }),
    income,
    expenses,
    savings,
    savingsRate,
    topCategories,
  };
}

export default function ReportsPage() {
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const { fetch: fetchAcc } = useAccountsStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    fetchTx();
    fetchAcc();
  }, [fetchTx, fetchAcc]);

  const current = useMemo(() => computeMonthSummary(transactions, currentDate), [transactions, currentDate]);
  const previous = useMemo(() => computeMonthSummary(transactions, subMonths(currentDate, 1)), [transactions, currentDate]);

  const incomeDelta = previous.income > 0 ? ((current.income - previous.income) / previous.income) * 100 : null;
  const expenseDelta = previous.expenses > 0 ? ((current.expenses - previous.expenses) / previous.expenses) * 100 : null;
  const savingsDelta = previous.savings !== 0 ? current.savings - previous.savings : null;

  const comparisonData = useMemo(() => {
    const allCatNames = new Set([...current.topCategories.map((c) => c.name), ...previous.topCategories.map((c) => c.name)]);
    return Array.from(allCatNames).map((name) => {
      const cur = current.topCategories.find((c) => c.name === name);
      const prev = previous.topCategories.find((c) => c.name === name);
      return { name, current: cur?.value || 0, previous: prev?.value || 0 };
    });
  }, [current, previous]);

  const barData = [
    { name: "Revenus", current: current.income, previous: previous.income },
    { name: "Dépenses", current: current.expenses, previous: previous.expenses },
    { name: "Épargne", current: current.savings, previous: previous.savings },
  ];

  const Delta = ({ value, inverted = false }: { value: number | null; inverted?: boolean }) => {
    if (value === null) return <span className="text-xs text-text-muted">—</span>;
    const isPositive = inverted ? value < 0 : value > 0;
    return (
      <span className={`text-xs font-mono font-bold ${isPositive ? "text-emerald-400" : value === 0 ? "text-text-muted" : "text-rose-400"}`}>
        {value > 0 ? "+" : ""}{value.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rapport mensuel</h1>
          <p className="text-text-muted text-sm mt-1">Comparaison mois par mois</p>
        </div>
        <div className="flex items-center gap-2 bg-surface-1 border border-surface-3 rounded-xl p-1 shrink-0 w-fit">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors text-text-muted hover:text-text-primary">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold min-w-[140px] text-center capitalize">{current.label}</span>
          <button onClick={() => setCurrentDate(subMonths(currentDate, -1))} className="p-1.5 hover:bg-surface-2 rounded-lg transition-colors text-text-muted hover:text-text-primary">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1.5"><ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />Revenus</span>
            <Delta value={incomeDelta} />
          </div>
          <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(current.income)}</p>
          <p className="text-[11px] text-text-muted mt-1">Mois précédent : {formatCurrency(previous.income)}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1.5"><ArrowDownRight className="w-3.5 h-3.5 text-rose-400" />Dépenses</span>
            <Delta value={expenseDelta} inverted />
          </div>
          <p className="text-xl font-bold font-mono text-rose-400">{formatCurrency(current.expenses)}</p>
          <p className="text-[11px] text-text-muted mt-1">Mois précédent : {formatCurrency(previous.expenses)}</p>
        </div>
        <div className="bg-surface-1 border border-brand-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted uppercase tracking-wider flex items-center gap-1.5"><Scale className="w-3.5 h-3.5 text-brand-400" />Épargne</span>
            {savingsDelta !== null ? (
              <span className={`text-xs font-mono font-bold ${savingsDelta >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {savingsDelta >= 0 ? "+" : ""}{formatCurrency(savingsDelta)}
              </span>
            ) : <span className="text-xs text-text-muted">—</span>}
          </div>
          <p className={`text-xl font-bold font-mono ${current.savings >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(current.savings)}</p>
          <p className="text-[11px] text-text-muted mt-1">Taux d'épargne : {current.savingsRate.toFixed(0)}% (préc. : {previous.savingsRate.toFixed(0)}%)</p>
        </div>
      </div>

      {/* Bar comparison chart */}
      <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
        <h3 className="text-sm font-semibold mb-6">Comparaison {format(subMonths(currentDate, 1), "MMM", { locale: fr })} vs {format(currentDate, "MMM", { locale: fr })}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barCategoryGap="25%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--surface-1)", border: "1px solid var(--surface-3)", borderRadius: 12, fontSize: 12, color: "var(--text-primary)" }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="previous" name={format(subMonths(currentDate, 1), "MMM yyyy", { locale: fr })} fill="#94a3b8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="current" name={format(currentDate, "MMM yyyy", { locale: fr })} fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Category comparison */}
      <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
        <h3 className="text-sm font-semibold mb-6">Dépenses par catégorie</h3>
        {comparisonData.length > 0 ? (
          <div className="space-y-4">
            {comparisonData.map((cat, i) => {
              const maxVal = Math.max(cat.current, cat.previous, 1);
              return (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                      {cat.name}
                    </span>
                    <span className="text-xs text-text-muted font-mono">
                      {cat.previous > 0 ? `${((cat.current / cat.previous - 1) * 100).toFixed(0)}%` : "—"}
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1 space-y-1">
                      <div className="h-2.5 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-surface-4" style={{ width: `${(cat.previous / maxVal) * 100}%` }} />
                      </div>
                      <div className="h-2.5 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(cat.current / maxVal) * 100}%`, backgroundColor: CAT_COLORS[i % CAT_COLORS.length] }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0 w-28">
                      <p className="text-xs font-mono font-bold">{formatCurrency(cat.current)}</p>
                      <p className="text-[10px] text-text-muted font-mono">préc. {formatCurrency(cat.previous)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-center text-text-muted text-sm py-8">Aucune donnée de dépenses</p>
        )}
      </div>
    </div>
  );
}
