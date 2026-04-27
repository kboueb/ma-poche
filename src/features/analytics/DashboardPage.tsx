import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { formatCurrency, formatCompact } from "@/lib/utils/currency";
import { formatDate, getMonthRange, getLast12Months } from "@/lib/utils/dates";
import { TrendingUp, TrendingDown, Wallet, ArrowUpRight, ArrowDownRight, PiggyBank, Plus, Target } from "lucide-react";
import { ACCOUNT_TYPE_LABELS } from "@/lib/utils/labels";
import { Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Line, ComposedChart } from "recharts";
import { parseISO, isWithinInterval } from "date-fns";

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 h-[120px] animate-pulse" />;
}

export default function DashboardPage() {
  const { transactions, loading: txLoading, fetch: fetchTx } = useTransactionsStore();
  const { accounts, loading: accLoading, fetch: fetchAcc } = useAccountsStore();
  const [goals, setGoals] = useState<any[]>([]);

  useEffect(() => { 
    fetchTx(); 
    fetchAcc(); 
    loadGoals();
  }, [fetchTx, fetchAcc]);

  const loadGoals = async () => {
    const { data } = await supabase.from("goals").select("*").order("current_amount", { ascending: false }).limit(3);
    setGoals(data || []);
  };

  const { start, end } = getMonthRange();

  const monthTx = useMemo(() =>
    transactions.filter((t) => {
      const d = parseISO(t.date);
      return isWithinInterval(d, { start, end });
    }),
    [transactions, start, end]
  );

  const income = useMemo(() => monthTx.filter((t) => t.flow === "income").reduce((s, t) => s + Number(t.amount), 0), [monthTx]);
  const expenses = useMemo(() => monthTx.filter((t) => t.flow === "expense").reduce((s, t) => s + Number(t.amount), 0), [monthTx]);
  const cashflow = income - expenses;
  const savingsRate = income > 0 ? (cashflow / income) * 100 : 0;

  const totalBalance = useMemo(() => {
    // Current balance is initial_balance + sum of all transactions for that account
    return accounts.reduce((total, acc) => {
      const accTx = transactions.filter(t => t.account_id === acc.id);
      const inc = accTx.filter(t => t.flow === "income").reduce((s, t) => s + Number(t.amount), 0);
      const exp = accTx.filter(t => t.flow === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return total + Number(acc.initial_balance || 0) + inc - exp;
    }, 0);
  }, [accounts, transactions]);

  // Chart data — last 12 months
  const chartData = useMemo(() => {
    const months = getLast12Months();
    return months.map(({ label, start: ms, end: me }) => {
      const txInMonth = transactions.filter((t) => {
        const d = parseISO(t.date);
        return isWithinInterval(d, { start: ms, end: me });
      });
      const inc = txInMonth.filter((t) => t.flow === "income").reduce((s, t) => s + Number(t.amount), 0);
      const exp = txInMonth.filter((t) => t.flow === "expense").reduce((s, t) => s + Number(t.amount), 0);
      return { label, income: inc, expenses: exp, net: inc - exp };
    });
  }, [transactions]);

  // Recent transactions
  const recent = transactions.slice(0, 8);

  const loading = txLoading || accLoading;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tableau de bord</h1>
        <p className="text-text-muted text-sm mt-1">{formatDate(new Date(), "MMMM yyyy")}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard label="Disponible" value={formatCurrency(totalBalance)} icon={Wallet} color="bg-brand-500/10 text-brand-400" />
            <StatCard label="Revenus" value={formatCurrency(income)} icon={ArrowUpRight} color="bg-emerald-500/10 text-emerald-400" />
            <StatCard label="Dépenses" value={formatCurrency(expenses)} icon={ArrowDownRight} color="bg-rose-500/10 text-rose-400" />
            <StatCard label="Cash-flow" value={formatCurrency(cashflow)} icon={cashflow >= 0 ? TrendingUp : TrendingDown} color={cashflow >= 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"} sub={`${savingsRate.toFixed(0)}% épargné`} />
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-surface-1 border border-surface-3 rounded-xl text-sm font-medium hover:bg-surface-2 transition-all">
          <Plus className="w-4 h-4 text-emerald-400" /> Nouvelle dépense
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-surface-1 border border-surface-3 rounded-xl text-sm font-medium hover:bg-surface-2 transition-all">
          <Target className="w-4 h-4 text-brand-400" /> Ajouter un objectif
        </button>
      </div>

      {/* Chart — Revenus vs Dépenses */}
      <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
        <h2 className="text-sm font-semibold mb-6">Revenus vs Dépenses — 12 derniers mois</h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} barCategoryGap="20%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatCompact(v)} />
              <Tooltip
                contentStyle={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--surface-4)", borderRadius: 12, fontSize: 12, color: "var(--text-primary)" }}
                labelStyle={{ color: "var(--text-secondary)" }}
                formatter={(v: number) => formatCurrency(v)}
              />
              <Bar dataKey="income" name="Revenus" fill="#34d399" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Dépenses" fill="#fb7185" radius={[4, 4, 0, 0]} />
              <Line type="monotone" dataKey="net" name="Solde net" stroke="#6366f1" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two columns: Recent + Accounts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent transactions */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4">Dernières transactions</h2>
          <div className="space-y-2">
            {recent.length === 0 && !loading && (
              <p className="text-center text-text-muted text-sm py-8">Aucune transaction</p>
            )}
            {recent.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 transition-colors">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${t.flow === "income" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                  {t.category?.icon ? t.category.icon.slice(0, 2) : (t.flow === "income" ? "↑" : "↓")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{t.description || t.category?.name || "Sans description"}</p>
                  <p className="text-[11px] text-text-muted">{formatDate(t.date, "d MMM")} · {t.account?.name}</p>
                </div>
                <p className={`text-sm font-mono font-bold ${t.flow === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                  {t.flow === "income" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Accounts overview */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2"><Wallet className="w-4 h-4 text-brand-400" /> Mes comptes</h2>
          <div className="space-y-2">
            {accounts.length === 0 && !loading && (
              <p className="text-center text-text-muted text-sm py-8">Aucun compte configuré</p>
            )}
            {accounts.map((acc) => {
              // Calculate balance from transactions
              const accTx = transactions.filter((t) => t.account_id === acc.id);
              const accIncome = accTx.filter((t) => t.flow === "income").reduce((s, t) => s + Number(t.amount), 0);
              const accExpenses = accTx.filter((t) => t.flow === "expense").reduce((s, t) => s + Number(t.amount), 0);
              const accBalance = accIncome - accExpenses;
              return (
                <div key={acc.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 transition-colors">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${acc.color}20`, color: acc.color }}>
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{acc.name}</p>
                    <p className="text-[11px] text-text-muted capitalize">{ACCOUNT_TYPE_LABELS[acc.type] || acc.type} {acc.institution && `· ${acc.institution}`}</p>
                  </div>
                  <p className={`text-sm font-mono font-bold ${accBalance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {formatCurrency(accBalance, acc.currency)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Goals progress section */}
      {goals.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Target className="w-4 h-4 text-brand-400" /> Objectifs prioritaires</h2>
            <button className="text-xs text-brand-400 hover:underline">Tout voir</button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            {goals.map((g) => {
              const pct = g.target_amount > 0 ? (Number(g.current_amount) / Number(g.target_amount)) * 100 : 0;
              return (
                <div key={g.id} className="bg-surface-1 border border-surface-3 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{g.icon === "target" ? "🎯" : g.icon}</span>
                    <span className="text-xs font-bold truncate">{g.name}</span>
                  </div>
                  <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: g.color }} />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-text-primary">{formatCurrency(Number(g.current_amount))}</span>
                    <span className="text-text-muted">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
