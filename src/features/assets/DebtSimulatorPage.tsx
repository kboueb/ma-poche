import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils/currency";
import { simulatePayoff, type SimDebt } from "@/lib/utils/debtSimulator";
import { Landmark, Snowflake, Flame, TrendingDown, CalendarCheck, PiggyBank } from "lucide-react";
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ComposedChart, Legend } from "recharts";
import type { Liability } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  CHART_SERIES, chartGridProps, axisTickSmall, axisLineProps,
  compactTick, tooltipStyle, currencyTooltip, legendStyle,
} from "@/lib/charts";

export default function DebtSimulatorPage() {
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [extra, setExtra] = useState("200");
  const [strategy, setStrategy] = useState<"snowball" | "avalanche">("avalanche");

  useEffect(() => {
    supabase.from("liabilities").select("*").then(({ data }) => setLiabilities((data as Liability[]) || []));
  }, []);

  const debts: SimDebt[] = useMemo(
    () =>
      liabilities
        .filter((l) => Number(l.remaining_amount) > 0)
        .map((l) => ({
          id: l.id,
          name: l.name,
          balance: Number(l.remaining_amount),
          rate: Number(l.interest_rate || 0),
          minPayment: Number(l.monthly_payment || 0),
        })),
    [liabilities]
  );

  const extraMonthly = Math.max(parseFloat(extra) || 0, 0);
  const snowball = useMemo(() => simulatePayoff(debts, extraMonthly, "snowball"), [debts, extraMonthly]);
  const avalanche = useMemo(() => simulatePayoff(debts, extraMonthly, "avalanche"), [debts, extraMonthly]);
  const active = strategy === "snowball" ? snowball : avalanche;
  const other = strategy === "snowball" ? avalanche : snowball;

  const chartData = useMemo(() => {
    const len = Math.max(snowball.curve.length, avalanche.curve.length);
    return Array.from({ length: len }, (_, i) => ({
      month: i,
      snowball: snowball.curve[i]?.remaining ?? 0,
      avalanche: avalanche.curve[i]?.remaining ?? 0,
    }));
  }, [snowball, avalanche]);

  const totalDebt = debts.reduce((s, d) => s + d.balance, 0);
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + active.months);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Simulateur de désendettement"
        subtitle={`${debts.length} dette${debts.length !== 1 ? "s" : ""} · ${formatCurrency(totalDebt)} au total`}
      />

      {debts.length === 0 ? (
        <div className="text-center py-20 bg-surface-1 border-2 border-dashed border-surface-3 rounded-3xl">
          <Landmark className="w-12 h-12 text-surface-3 mx-auto mb-4" />
          <p className="text-text-muted">Aucune dette à simuler</p>
          <p className="text-text-muted text-xs mt-1">Ajoutez des passifs dans la page Patrimoine</p>
        </div>
      ) : (
        <>
          {/* Contrôles */}
          <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Effort mensuel supplémentaire
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  className="w-32 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2 text-sm font-mono outline-none focus:border-brand-500"
                />
                <span className="text-xs text-text-muted">/ mois en plus des mensualités</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 p-1 bg-surface-2 rounded-xl">
              <button
                onClick={() => setStrategy("snowball")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${strategy === "snowball" ? "bg-surface-0 shadow" : "text-text-muted"}`}
              >
                <Snowflake className="w-3.5 h-3.5" /> Snowball
              </button>
              <button
                onClick={() => setStrategy("avalanche")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${strategy === "avalanche" ? "bg-surface-0 shadow" : "text-text-muted"}`}
              >
                <Flame className="w-3.5 h-3.5" /> Avalanche
              </button>
            </div>
          </div>

          <p className="text-xs text-text-muted">
            {strategy === "snowball"
              ? "Snowball : on rembourse d'abord les plus petits soldes (victoires rapides, motivation)."
              : "Avalanche : on rembourse d'abord les taux les plus élevés (coût total minimal)."}
          </p>

          {/* Résultats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5 text-brand-400" />Libéré dans</p>
              <p className="text-xl font-bold font-mono">{active.months} mois</p>
              <p className="text-[11px] text-text-muted mt-1">
                soit {endDate.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-rose-400" />Intérêts totaux</p>
              <p className="text-xl font-bold font-mono text-rose-400">{formatCurrency(active.totalInterest)}</p>
              <p className="text-[11px] text-text-muted mt-1">
                {other.totalInterest > active.totalInterest
                  ? `économie de ${formatCurrency(other.totalInterest - active.totalInterest)} vs ${strategy === "snowball" ? "avalanche" : "snowball"}`
                  : "stratégie la moins chère"}
              </p>
            </div>
            <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
              <p className="text-xs text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><PiggyBank className="w-3.5 h-3.5 text-emerald-400" />Coût total</p>
              <p className="text-xl font-bold font-mono">{formatCurrency(active.totalPaid)}</p>
              <p className="text-[11px] text-text-muted mt-1">mensualités + effort supplémentaire</p>
            </div>
          </div>

          {/* Courbe */}
          <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
            <h3 className="text-sm font-semibold mb-6">Capital restant dû — comparatif</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid {...chartGridProps} />
                  <XAxis dataKey="month" tick={axisTickSmall} {...axisLineProps} tickFormatter={(m) => `M${m}`} />
                  <YAxis tick={axisTickSmall} {...axisLineProps} tickFormatter={compactTick} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={currencyTooltip}
                    labelFormatter={(m) => `Mois ${m}`}
                  />
                  <Legend wrapperStyle={legendStyle} />
                  <Line type="monotone" dataKey="snowball" name="Snowball" stroke={CHART_SERIES.snowball} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="avalanche" name="Avalanche" stroke={CHART_SERIES.avalanche} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dettes prises en compte */}
          <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
            <h3 className="text-sm font-semibold mb-3">Dettes prises en compte</h3>
            <div className="space-y-2">
              {debts.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">{d.name}</span>
                  <span className="text-xs text-text-muted font-mono shrink-0 ml-3">
                    {formatCurrency(d.balance)} · {d.rate}% · {formatCurrency(d.minPayment)}/mois
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
