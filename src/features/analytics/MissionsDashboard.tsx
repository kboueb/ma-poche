import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { startOfWeek, endOfWeek, parseISO, isWithinInterval } from "date-fns";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useTimeStore } from "@/stores/useTimeStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { formatCurrency, convertToBase } from "@/lib/utils/currency";
import { formatDate, getMonthRange, formatDue } from "@/lib/utils/dates";
import { formatDuration, entryMinutes } from "@/lib/utils/time";
import {
  Banknote, Clock, Briefcase, TriangleAlert, BadgeCheck,
  CalendarClock, ArrowUpRight, ChevronRight,
} from "lucide-react";
import { Bar, BarChart, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import {
  CHART_SERIES, tooltipStyle,
} from "@/lib/charts";
import { Stat } from "@/components/ui/Stat";
import { useQuotesStore } from "@/stores/useQuotesStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
  budgetStatus, expectedRevenue, isQuoteExpired, monthlyBillingCandidates, nextMonths, previousMonth,
  projectMinutes, quoteTotals, workloadByMonth,
} from "@/lib/utils/missionMetrics";
import { Gauge, FileSignature, Repeat } from "lucide-react";

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toISOString().slice(0, 10));
}

export default function MissionsDashboard() {
  const { projects, milestones, fetch: fetchProjects } = useProjectsStore();
  const { tasks, entries, loaded: timeLoaded, fetch: fetchTime } = useTimeStore();
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const { quotes, fetch: fetchQuotes } = useQuotesStore();
  const { hoursPerDay, capacityDaysPerMonth } = useSettingsStore();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
    fetchTx();
    fetchQuotes();
    if (!timeLoaded) fetchTime();
  }, [fetchProjects, fetchTx, fetchQuotes, fetchTime, timeLoaded]);

  const today = new Date().toISOString().slice(0, 10);

  // ---- Charge des 3 prochains mois ----
  const workload = useMemo(
    () => workloadByMonth(projects, entries, nextMonths(today, 3), today, hoursPerDay),
    [projects, entries, today, hoursPerDay],
  );

  // ---- À traiter : régie du mois dernier, devis en attente, budgets ----
  const lastMonth = previousMonth(today);
  const regieToBill = useMemo(
    () => monthlyBillingCandidates(projects, entries, lastMonth, hoursPerDay),
    [projects, entries, lastMonth, hoursPerDay],
  );
  const pendingQuotes = useMemo(() => quotes.filter((q) => q.status === "sent"), [quotes]);
  const budgetAlerts = useMemo(
    () => projects
      .filter((p) => p.status === "active")
      .map((p) => ({ p, b: budgetStatus(p, projectMinutes(p.id, entries), hoursPerDay) }))
      .filter((x) => x.b && x.b.level !== "ok"),
    [projects, entries, hoursPerDay],
  );

  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const { start: monthStart, end: monthEnd } = getMonthRange(now);

  const inWeek = (d: string) => isWithinInterval(parseISO(d), { start: weekStart, end: weekEnd });

  const activeProjects = useMemo(() => projects.filter((p) => p.status === "active"), [projects]);

  const projectIncome = (projectId: string, from: Date, to: Date) =>
    transactions
      .filter((t) => t.flow === "income" && t.project_id === projectId &&
        isWithinInterval(parseISO(t.date), { start: from, end: to }))
      .reduce((s, t) => s + convertToBase(Number(t.amount), t.account?.currency), 0);

  const totalProjectIncome = (projectId: string) =>
    transactions
      .filter((t) => t.flow === "income" && t.project_id === projectId)
      .reduce((s, t) => s + convertToBase(Number(t.amount), t.account?.currency), 0);

  // ---- Stats ----
  const incomeMonth = useMemo(
    () => activeProjects.reduce((s, p) => s + projectIncome(p.id, monthStart, monthEnd), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProjects, transactions]
  );

  const outstanding = useMemo(
    () => activeProjects.reduce((s, p) => {
      const expected = p.recurring_monthly ? null : expectedRevenue(p, hoursPerDay);
      if (expected == null) return s;
      return s + Math.max(expected - totalProjectIncome(p.id), 0);
    }, 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeProjects, transactions, hoursPerDay]
  );

  const weekEntries = useMemo(() => entries.filter((e) => inWeek(e.started_at)), [entries]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekMinutes = useMemo(
    () => weekEntries.reduce((s, e) => s + entryMinutes(e.started_at, e.ended_at, e.duration_minutes), 0),
    [weekEntries]
  );
  const weekValued = useMemo(() => {
    let total = 0;
    weekEntries.forEach((e) => {
      if (!e.billable) return;
      const p = projects.find((x) => x.id === e.project_id);
      const rate = p?.hourly_rate ? Number(p.hourly_rate) : p?.daily_rate ? Number(p.daily_rate) / hoursPerDay : 0;
      total += (entryMinutes(e.started_at, e.ended_at, e.duration_minutes) / 60) * rate;
    });
    return total;
  }, [weekEntries, projects, hoursPerDay]);

  const overdueProjects = useMemo(
    () => activeProjects.filter((p) => isOverdue(p.deadline)),
    [activeProjects]
  );
  const overdueMilestones = useMemo(
    () => milestones.filter((m) => !m.done && isOverdue(m.due_date)),
    [milestones]
  );
  const pendingValidations = useMemo(
    () => milestones.filter((m) => !m.done && m.kind === "validation"),
    [milestones]
  );
  const alertCount = overdueProjects.length + overdueMilestones.length + pendingValidations.length;

  // ---- Heures par projet (semaine) ----
  const hoursByProject = useMemo(() => {
    const map = new Map<string, number>();
    weekEntries.forEach((e) => {
      map.set(e.project_id, (map.get(e.project_id) || 0) + entryMinutes(e.started_at, e.ended_at, e.duration_minutes));
    });
    return Array.from(map.entries())
      .map(([pid, minutes]) => {
        const p = projects.find((x) => x.id === pid);
        return { name: p ? `${p.client_name}` : "Sans projet", fullName: p ? `${p.client_name} — ${p.name}` : "Sans projet", minutes };
      })
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 6);
  }, [weekEntries, projects]);

  // ---- Échéances 7 jours ----
  const upcoming = useMemo(() => {
    const items: Array<{ id: string; label: string; sub: string; due: string; late: boolean }> = [];
    activeProjects.forEach((p) => {
      if (!p.deadline) return;
      const diff = Math.round((new Date(p.deadline).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86400000);
      if (diff >= -30 && diff <= 7) {
        items.push({ id: `p-${p.id}`, label: `${p.client_name} — ${p.name}`, sub: "Échéance mission", due: p.deadline, late: diff < 0 });
      }
    });
    milestones.filter((m) => !m.done && m.due_date).forEach((m) => {
      const diff = Math.round((new Date(m.due_date!).getTime() - new Date(new Date().toISOString().slice(0, 10)).getTime()) / 86400000);
      if (diff >= -30 && diff <= 7) {
        const p = projects.find((x) => x.id === m.project_id);
        items.push({ id: `m-${m.id}`, label: m.title, sub: p ? `${p.client_name}` : "Jalon", due: m.due_date!, late: diff < 0 });
      }
    });
    return items.sort((a, b) => a.due.localeCompare(b.due)).slice(0, 6);
  }, [activeProjects, milestones, projects]);

  // ---- Derniers paiements mission ----
  const recentIncome = useMemo(
    () => transactions.filter((t) => t.flow === "income" && t.project_id).slice(0, 5),
    [transactions]
  );

  const openTasks = useMemo(() => tasks.filter((t) => !t.done).length, [tasks]);

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Encaissé (mois)" value={formatCurrency(incomeMonth)} icon={Banknote} accent="bg-emerald-500/10 text-emerald-400" sub={`Reste : ${formatCurrency(outstanding)}`} valueClass="text-emerald-400" stagger={0} />
        <Stat label="Heures (semaine)" value={formatDuration(weekMinutes)} icon={Clock} accent="bg-brand-500/10 text-brand-400" sub={`Valorisé : ${formatCurrency(weekValued)}`} stagger={1} />
        <Stat label="Missions actives" value={String(activeProjects.length)} icon={Briefcase} accent="bg-brand-500/10 text-brand-400" sub={`${openTasks} tâche${openTasks > 1 ? "s" : ""} ouverte${openTasks > 1 ? "s" : ""}`} stagger={2} />
        <Stat label="Alertes" value={String(alertCount)} icon={TriangleAlert} accent="bg-amber-500/10 text-amber-400" sub={`${pendingValidations.length} validation${pendingValidations.length > 1 ? "s" : ""} en attente`} valueClass={alertCount > 0 ? "text-amber-400" : undefined} stagger={3} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Heures par projet */}
        <div className="lg:col-span-2 bg-surface-1 border border-surface-3 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold">Heures par client — cette semaine</h2>
            <button onClick={() => navigate("/temps")} className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              Détail <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {hoursByProject.length === 0 ? (
            <p className="text-center text-xs text-text-muted py-10">Aucun temps enregistré cette semaine.<br />Lance un timer depuis une mission.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hoursByProject} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "var(--text-muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number | string | Array<number | string>) => formatDuration(Number(Array.isArray(v) ? v[0] : v))} />
                  <Bar dataKey="minutes" name="Heures" fill={CHART_SERIES.primary} radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Échéances */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="w-4 h-4 text-brand-400" />Échéances</h2>
            <button onClick={() => navigate("/echeancier")} className="text-xs text-brand-400 hover:underline flex items-center gap-1">
              Tout voir <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-center text-xs text-text-muted py-8">Rien d'urgent.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((u) => (
                <div key={u.id} className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-surface-2 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{u.label}</p>
                    <p className="text-[10px] text-text-muted">{u.sub}</p>
                  </div>
                  <span className={`text-[11px] font-semibold shrink-0 ${u.late ? "text-rose-400" : "text-text-muted"}`}>
                    {formatDue(u.due)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Charge */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Gauge className="w-4 h-4 text-brand-400" />Charge à venir</h2>
            <span className="text-[11px] text-text-muted">capacité {capacityDaysPerMonth} j/mois</span>
          </div>
          <div className="space-y-3">
            {workload.map((m) => {
              const pct = Math.round((m.days / capacityDaysPerMonth) * 100);
              const color = pct > 100 ? "bg-rose-500" : pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-sky-500";
              const top = [...m.byProject].sort((a, b) => b.days - a.days).slice(0, 2)
                .map((x) => projects.find((p) => p.id === x.projectId)?.client_name).filter(Boolean).join(", ");
              return (
                <div key={m.month}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium capitalize">{formatDate(`${m.month}-01`, "MMMM")}</span>
                    <span className="font-mono text-text-muted">
                      {String(Math.round(m.days * 10) / 10).replace(".", ",")} j · <b className={pct > 100 ? "text-rose-400" : "text-text-primary"}>{pct} %</b>
                    </span>
                  </div>
                  <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-text-muted mt-0.5 truncate">
                    {m.days === 0 ? "Rien de vendu : c'est le moment de prospecter." : top}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-text-muted mt-3">Jours restants des missions actives (budget − temps passé) répartis jusqu'à leur échéance ; régies au nombre de jours par mois.</p>
        </div>

        {/* À traiter */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-3">À traiter</h2>
          {regieToBill.length === 0 && pendingQuotes.length === 0 && budgetAlerts.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">Rien à signaler.</p>
          ) : (
            <div className="space-y-1.5">
              {regieToBill.length > 0 && (
                <button
                  onClick={() => navigate(`/factures?regie=${lastMonth}`)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-sky-500/10 text-xs text-left hover:bg-sky-500/15"
                >
                  <Repeat className="w-4 h-4 text-sky-400 shrink-0" />
                  <span className="flex-1">
                    <b>{regieToBill.length} régie{regieToBill.length > 1 ? "s" : ""}</b> à facturer pour {formatDate(`${lastMonth}-01`, "MMMM")}
                  </span>
                  <span className="font-mono font-bold">
                    {formatCurrency(regieToBill.reduce((s, c) => s + (c.line ? c.line.quantity * c.line.unit_price : 0), 0))}
                  </span>
                </button>
              )}
              {pendingQuotes.slice(0, 3).map((q) => {
                const expired = isQuoteExpired(q, today);
                return (
                  <button
                    key={q.id}
                    onClick={() => navigate(`/devis?quote=${q.id}`)}
                    className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 text-xs text-left hover:bg-surface-3"
                  >
                    <FileSignature className={`w-4 h-4 shrink-0 ${expired ? "text-amber-400" : "text-text-muted"}`} />
                    <span className="flex-1 truncate">{q.title}</span>
                    <span className="font-mono">{formatCurrency(quoteTotals(q.items || [], q.vat_rate).ht)}</span>
                    <span className={`shrink-0 ${expired ? "text-amber-400 font-semibold" : "text-text-muted"}`}>{expired ? "Expiré : relancer" : "En attente"}</span>
                  </button>
                );
              })}
              {budgetAlerts.slice(0, 3).map(({ p, b }) => (
                <button
                  key={p.id}
                  onClick={() => navigate(`/missions?project=${p.id}`)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 text-xs text-left hover:bg-surface-3"
                >
                  <Gauge className={`w-4 h-4 shrink-0 ${b!.level === "over" ? "text-rose-400" : "text-amber-400"}`} />
                  <span className="flex-1 truncate">{p.client_name} — {p.name}</span>
                  <span className={`font-mono font-bold ${b!.level === "over" ? "text-rose-400" : "text-amber-400"}`}>{b!.pct} % du budget</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Validations */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><BadgeCheck className="w-4 h-4 text-amber-400" />Validations en attente ({pendingValidations.length})</h2>
            <button onClick={() => navigate("/missions")} className="text-xs text-brand-400 hover:underline">Missions</button>
          </div>
          {pendingValidations.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">Aucune validation en attente.</p>
          ) : (
            <div className="space-y-1.5">
              {pendingValidations.slice(0, 5).map((m) => {
                const p = projects.find((x) => x.id === m.project_id);
                return (
                  <div key={m.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-2 text-xs">
                    <span className="flex-1 truncate font-medium">{m.title}</span>
                    <span className="text-text-muted shrink-0">{p?.client_name || ""}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Derniers paiements */}
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Derniers paiements clients</h2>
            <button onClick={() => navigate("/transactions")} className="text-xs text-brand-400 hover:underline">Transactions</button>
          </div>
          {recentIncome.length === 0 ? (
            <p className="text-xs text-text-muted py-4 text-center">Aucun paiement lié pour l'instant.<br />Lie tes revenus à une mission.</p>
          ) : (
            <div className="space-y-1.5">
              {recentIncome.map((t) => {
                const p = projects.find((x) => x.id === t.project_id);
                return (
                  <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-2 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{t.description || p?.name || "Paiement"}</p>
                      <p className="text-[10px] text-text-muted">{formatDate(t.date, "d MMM")} · {p?.client_name || ""}</p>
                    </div>
                    <p className="text-xs font-mono font-bold text-emerald-400 shrink-0">+{formatCurrency(convertToBase(Number(t.amount), t.account?.currency))}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
