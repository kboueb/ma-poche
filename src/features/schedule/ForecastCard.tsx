import { useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertTriangle, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { computeCashForecast } from "@/lib/utils/cashForecast";
import type { UpcomingPayment } from "@/lib/utils/upcomingPayments";
import { axisLineProps, axisTickSmall, chartGridProps, compactTick, currencyTooltip, tooltipLabelStyle, tooltipStyle } from "@/lib/charts";

type Horizon = "30" | "60" | "90";

interface ForecastCardProps {
  startBalance: number;
  /** Échéancier sur au moins 90 jours */
  upcoming: UpcomingPayment[];
  /** Reste à mettre de côté pour impôts et charges (null si la provision est désactivée) */
  provision: number | null;
}

export function ForecastCard({ startBalance, upcoming, provision }: ForecastCardProps) {
  const [horizon, setHorizon] = useState<Horizon>("60");
  const [withoutClientIncome, setWithoutClientIncome] = useState(false);

  const forecast = useMemo(
    () => computeCashForecast(startBalance, upcoming, { horizonDays: Number(horizon), withoutClientIncome }),
    [startBalance, upcoming, horizon, withoutClientIncome]
  );

  const belowProvision = provision !== null && provision > 0 && forecast.lowest.balance < provision;
  const tone = forecast.firstNegative ? "text-rose-400" : belowProvision ? "text-amber-400" : "text-emerald-400";

  return (
    <Card className="p-5 md:p-6 space-y-5" stagger={0}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SectionTitle><TrendingUp className="w-4 h-4 text-brand-400" /> Trésorerie prévue</SectionTitle>
        <SegmentedControl
          size="sm"
          value={horizon}
          onChange={setHorizon}
          options={[
            { value: "30", label: "30 j" },
            { value: "60", label: "60 j" },
            { value: "90", label: "90 j" },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-[11px] text-text-muted uppercase tracking-wider">Aujourd'hui</p>
          <p className="text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5">{formatCurrency(startBalance)}</p>
        </div>
        <div>
          <p className="text-[11px] text-text-muted uppercase tracking-wider">Point bas</p>
          <p className={`text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5 ${tone}`}>{formatCurrency(forecast.lowest.balance)}</p>
          <p className="text-[11px] text-text-muted">{formatDate(forecast.lowest.date, "d MMM")}</p>
        </div>
        <div>
          <p className="text-[11px] text-text-muted uppercase tracking-wider">Dans {horizon} jours</p>
          <p className="text-base sm:text-lg font-bold font-mono tabular-nums mt-0.5">{formatCurrency(forecast.end)}</p>
          <p className="text-[11px] text-text-muted">
            <span className="text-emerald-400">+{formatCurrency(forecast.totalIncome)}</span>{" "}
            <span className="text-rose-400">−{formatCurrency(forecast.totalExpense)}</span>
          </p>
        </div>
      </div>

      {(forecast.firstNegative || belowProvision) && (
        <div className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs ${forecast.firstNegative ? "bg-rose-500/10 text-rose-400" : "bg-amber-500/10 text-amber-400"}`}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <p>
            {forecast.firstNegative
              ? `Découvert prévu le ${formatDate(forecast.firstNegative, "d MMMM")}${withoutClientIncome ? " si les clients ne paient pas" : ""}.`
              : `Le ${formatDate(forecast.lowest.date, "d MMMM")}, le solde passe sous la provision impôts (${formatCurrency(provision!)}) : vous puiseriez dans l'argent mis de côté.`}
          </p>
        </div>
      )}

      <div className="h-56 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={forecast.points}>
            <defs>
              <linearGradient id="forecast-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="date" tick={axisTickSmall} {...axisLineProps} tickFormatter={(d: string) => formatDate(d, "d MMM")} minTickGap={24} />
            <YAxis tick={axisTickSmall} {...axisLineProps} tickFormatter={compactTick} width={56} />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipLabelStyle}
              itemStyle={{ color: "var(--text-primary)" }}
              labelFormatter={(d) => formatDate(String(d), "EEEE d MMMM")}
              formatter={(v) => [currencyTooltip(v as number), "Solde prévu"]}
            />
            <ReferenceLine y={0} stroke="#f43f5e" strokeOpacity={0.5} />
            {provision !== null && provision > 0 && (
              <ReferenceLine
                y={provision}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: "Provision impôts", position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
              />
            )}
            <Area type="stepAfter" dataKey="balance" stroke="#10b981" strokeWidth={2} fill="url(#forecast-fill)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={withoutClientIncome}
          onChange={(e) => setWithoutClientIncome(e.target.checked)}
          className="accent-emerald-500 w-3.5 h-3.5"
        />
        Scénario prudent : sans les paiements clients attendus
      </label>
    </Card>
  );
}
