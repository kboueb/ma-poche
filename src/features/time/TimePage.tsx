import { useEffect, useMemo, useState } from "react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, addWeeks, addMonths, format } from "date-fns";
import { fr } from "date-fns/locale";
import { useTimeStore } from "@/stores/useTimeStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDuration, parseDuration, entryMinutes } from "@/lib/utils/time";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import {
  Play, Square, Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight,
  Download, Clock, Briefcase,
} from "lucide-react";
import { toast } from "sonner";

function escapeCsvCell(cell: unknown): string {
  const s = String(cell ?? "").replace(/"/g, '""');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}

export default function TimePage() {
  const {
    tasks, entries, fetch, loaded,
    activeEntry, startTimer, stopTimer, addManualEntry, removeEntry,
  } = useTimeStore();
  const { projects, fetch: fetchProjects } = useProjectsStore();

  const [mode, setMode] = useState<"week" | "month">("week");
  const [offset, setOffset] = useState(0);
  const [manualOpen, setManualOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Formulaire démarrage rapide
  const [quickTask, setQuickTask] = useState("");
  // Formulaire saisie manuelle
  const [mProject, setMProject] = useState("");
  const [mTask, setMTask] = useState("");
  const [mDate, setMDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [mStart, setMStart] = useState("09:00");
  const [mDuration, setMDuration] = useState("1h");
  const [mDesc, setMDesc] = useState("");
  const [mBillable, setMBillable] = useState(true);
  // Description à la volée sur le timer actif
  const [stopDesc, setStopDesc] = useState("");

  useEffect(() => { fetch(); fetchProjects(); }, [fetch, fetchProjects]);

  const active = activeEntry();

  // Tick pour l'affichage du timer en cours
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Période ----
  const { rangeStart, rangeEnd, rangeLabel } = useMemo(() => {
    const base = new Date();
    if (mode === "week") {
      const ref = addWeeks(base, offset);
      const s = startOfWeek(ref, { weekStartsOn: 1 });
      const e = endOfWeek(ref, { weekStartsOn: 1 });
      const label = offset === 0 ? "Cette semaine" :
        `${format(s, "d MMM", { locale: fr })} – ${format(e, "d MMM yyyy", { locale: fr })}`;
      return { rangeStart: s, rangeEnd: e, rangeLabel: label };
    }
    const ref = addMonths(base, offset);
    const s = startOfMonth(ref);
    const e = endOfMonth(ref);
    const label = offset === 0 ? "Ce mois-ci" : format(s, "MMMM yyyy", { locale: fr });
    return { rangeStart: s, rangeEnd: e, rangeLabel: label };
  }, [mode, offset]);

  const periodEntries = useMemo(() => {
    return entries.filter((e) => {
      const d = new Date(e.started_at);
      return d >= rangeStart && d <= rangeEnd;
    });
  }, [entries, rangeStart, rangeEnd]);

  const projectName = (id: string) => {
    const p = projects.find((x) => x.id === id);
    return p ? `${p.client_name} — ${p.name}` : "Sans projet";
  };

  // ---- Rapport groupé par projet ----
  const report = useMemo(() => {
    const map = new Map<string, { minutes: number; billableMinutes: number; count: number }>();
    periodEntries.forEach((e) => {
      const mins = entryMinutes(e.started_at, e.ended_at, e.duration_minutes);
      const cur = map.get(e.project_id) || { minutes: 0, billableMinutes: 0, count: 0 };
      cur.minutes += mins;
      if (e.billable) cur.billableMinutes += mins;
      cur.count++;
      map.set(e.project_id, cur);
    });
    return Array.from(map.entries())
      .map(([projectId, v]) => {
        const p = projects.find((x) => x.id === projectId);
        const amount = p?.hourly_rate ? (v.billableMinutes / 60) * Number(p.hourly_rate) : null;
        return { projectId, name: projectName(projectId), rate: p?.hourly_rate ? Number(p.hourly_rate) : null, ...v, amount };
      })
      .sort((a, b) => b.minutes - a.minutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodEntries, projects]);

  const totalMinutes = report.reduce((s, r) => s + r.minutes, 0);
  const totalBillable = report.reduce((s, r) => s + r.billableMinutes, 0);
  const totalAmount = report.reduce((s, r) => s + (r.amount || 0), 0);
  const maxMinutes = Math.max(...report.map((r) => r.minutes), 1);

  const activeTasks = tasks.filter((t) => !t.done);

  const handleStart = async () => {
    if (!quickTask) { toast.error("Choisis une tâche"); return; }
    await startTimer(quickTask);
    setQuickTask("");
  };

  const handleManual = async () => {
    if (!mProject) { toast.error("Choisis un projet"); return; }
    const mins = parseDuration(mDuration);
    if (mins == null || mins <= 0) { toast.error("Durée illisible (ex : 1h30, 45m, 1:30)"); return; }
    await addManualEntry({
      project_id: mProject,
      task_id: mTask || null,
      description: mDesc || null,
      date: mDate,
      startTime: mStart,
      durationMinutes: mins,
      billable: mBillable,
    });
    setManualOpen(false);
    setMDesc(""); setMDuration("1h"); setMTask("");
  };

  const handleExport = () => {
    if (periodEntries.length === 0) { toast.info("Rien à exporter sur cette période"); return; }
    const rows = periodEntries.map((e) => {
      const p = projects.find((x) => x.id === e.project_id);
      const mins = entryMinutes(e.started_at, e.ended_at, e.duration_minutes);
      return [
        format(new Date(e.started_at), "yyyy-MM-dd"),
        p?.client_name || "",
        p?.name || "",
        e.task?.title || "",
        e.description || "",
        format(new Date(e.started_at), "HH:mm"),
        e.ended_at ? format(new Date(e.ended_at), "HH:mm") : "en cours",
        mins,
        e.billable ? "oui" : "non",
        p?.hourly_rate && e.billable ? ((mins / 60) * Number(p.hourly_rate)).toFixed(2) : "",
      ];
    });
    const csv = [
      ["Date", "Client", "Projet", "Tâche", "Description", "Début", "Fin", "Durée (min)", "Facturable", "Montant"].join(","),
      ...rows.map((r) => r.map((c) => `"${escapeCsvCell(c)}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `temps_${format(rangeStart, "yyyy-MM-dd")}_${format(rangeEnd, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Rapport exporté");
  };

  const activeElapsed = active
    ? Math.max(Math.floor((now - new Date(active.started_at).getTime()) / 1000), 0)
    : 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const elapsedStr = `${pad(Math.floor(activeElapsed / 3600))}:${pad(Math.floor((activeElapsed % 3600) / 60))}:${pad(activeElapsed % 60)}`;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Temps de travail"
        subtitle={`${formatDuration(totalMinutes)} sur la période · ${formatCurrency(totalAmount)} valorisés`}
        actions={
          <>
            <div className="grid grid-cols-2 gap-1 p-1 bg-surface-1 border border-surface-3 rounded-xl">
              <button onClick={() => { setMode("week"); setOffset(0); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "week" ? "bg-surface-3 text-text-primary" : "text-text-muted"}`}>Semaine</button>
              <button onClick={() => { setMode("month"); setOffset(0); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "month" ? "bg-surface-3 text-text-primary" : "text-text-muted"}`}>Mois</button>
            </div>
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={handleExport}>Export CSV</Button>
          </>
        }
      />

      {/* Timer actif */}
      {active && (() => {
        const t = tasks.find((x) => x.id === active.task_id);
        return (
          <div className="bg-brand-500/10 border border-brand-500/30 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="relative flex w-3 h-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-brand-500" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{t?.title || "Tâche"}</p>
                <p className="text-[11px] text-text-muted truncate">{projectName(active.project_id)}</p>
              </div>
            </div>
            <p className="text-2xl font-mono font-bold tabular-nums">{elapsedStr}</p>
            <div className="flex gap-2">
              <input
                value={stopDesc}
                onChange={(e) => setStopDesc(e.target.value)}
                placeholder="Note (optionnel)..."
                className="flex-1 sm:w-48 bg-surface-1 border border-surface-4 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500"
              />
              <Button onClick={() => { stopTimer(stopDesc || undefined); setStopDesc(""); }} icon={<Square className="w-4 h-4" />}>Stop</Button>
            </div>
          </div>
        );
      })()}

      {/* Démarrage rapide + saisie manuelle */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Play className="w-4 h-4 text-brand-400" /> Démarrer un timer</h3>
          {activeTasks.length === 0 ? (
            <p className="text-xs text-text-muted">Crée des tâches depuis une mission pour lancer un timer.</p>
          ) : (
            <div className="flex gap-2">
              <Select
                options={activeTasks.map((t) => {
                  const p = projects.find((x) => x.id === t.project_id);
                  return { value: t.id, label: `${p ? `${p.client_name} · ` : ""}${t.title}` };
                })}
                value={quickTask}
                onChange={(e) => setQuickTask(e.target.value)}
                placeholder="Choisir une tâche..."
              />
              <Button onClick={handleStart} disabled={!!active}>Start</Button>
            </div>
          )}
          {active && <p className="text-[11px] text-text-muted">Un timer est en cours : le démarrer en stoppera l'actuel.</p>}
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><Plus className="w-4 h-4 text-brand-400" /> Saisie manuelle</h3>
          <p className="text-xs text-text-muted">Ajoute ton temps en fin de journée (ex : 1h30, 45m).</p>
          <Button variant="secondary" onClick={() => setManualOpen(true)}>Saisir du temps</Button>
        </div>
      </div>

      {/* Navigation période */}
      <div className="flex items-center justify-between">
        <button onClick={() => setOffset((o) => o - 1)} className="p-2 hover:bg-surface-2 rounded-lg text-text-muted transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <p className="text-sm font-semibold capitalize flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-brand-400" /> {rangeLabel}
        </p>
        <button onClick={() => setOffset((o) => Math.min(o + 1, 0))} disabled={offset >= 0} className="p-2 hover:bg-surface-2 rounded-lg text-text-muted transition-colors disabled:opacity-30">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Rapport */}
      <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
        <h3 className="text-sm font-semibold mb-4">Récap par projet</h3>
        {report.length === 0 ? (
          <p className="text-center text-xs text-text-muted py-6">Aucun temps enregistré sur cette période.</p>
        ) : (
          <div className="space-y-3">
            {report.map((r) => (
              <div key={r.projectId}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="font-medium truncate flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-text-muted shrink-0" /> {r.name}
                  </span>
                  <span className="text-xs font-mono shrink-0 ml-2">
                    {formatDuration(r.minutes)}
                    {r.amount != null && <span className="text-emerald-400"> · {formatCurrency(r.amount)}</span>}
                  </span>
                </div>
                <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${(r.minutes / maxMinutes) * 100}%` }} />
                </div>
                <p className="text-[10px] text-text-muted mt-0.5">
                  {r.count} entrée{r.count > 1 ? "s" : ""} · {formatDuration(r.billableMinutes)} facturable{r.rate ? ` · taux ${formatCurrency(r.rate)}/h` : ""}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 border-t border-surface-3 text-sm font-bold">
              <span>Total ({formatDuration(totalMinutes - totalBillable)} non facturable)</span>
              <span className="font-mono">{formatDuration(totalMinutes)} · <span className="text-emerald-400">{formatCurrency(totalAmount)}</span></span>
            </div>
          </div>
        )}
      </div>

      {/* Entrées de la période */}
      <div className="bg-surface-1 border border-surface-3 rounded-2xl divide-y divide-surface-3 overflow-hidden">
        <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary px-4 pt-4 pb-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> Entrées ({periodEntries.length})
        </p>
        {periodEntries.length === 0 && <p className="text-center text-xs text-text-muted px-4 pb-4">—</p>}
        {periodEntries.map((e) => {
          const mins = entryMinutes(e.started_at, e.ended_at, e.duration_minutes);
          return (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-xs group">
              <span className="font-mono text-text-muted shrink-0 w-24">
                {format(new Date(e.started_at), "d MMM HH:mm", { locale: fr })}
              </span>
              <span className="flex-1 min-w-0 truncate">
                <span className="font-medium">{e.task?.title || projectName(e.project_id)}</span>
                {e.description && <span className="text-text-muted"> — {e.description}</span>}
                {!e.billable && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-surface-3 rounded text-text-muted">non facturable</span>}
                {!e.ended_at && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-brand-500/15 text-brand-400 rounded">en cours</span>}
              </span>
              <span className="font-mono font-bold shrink-0">{formatDuration(mins)}</span>
              {e.ended_at && (
                <button onClick={() => removeEntry(e.id)} className="p-1 text-text-muted hover:text-rose-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity" title="Supprimer">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal saisie manuelle */}
      <Modal isOpen={manualOpen} onClose={() => setManualOpen(false)} title="Saisir du temps" size="sm">
        <div className="space-y-4">
          <Select
            label="Projet"
            options={projects.filter((p) => p.status === "active").map((p) => ({ value: p.id, label: `${p.client_name} — ${p.name}` }))}
            value={mProject}
            onChange={(e) => { setMProject(e.target.value); setMTask(""); }}
            placeholder="Choisir..."
          />
          <Select
            label="Tâche (optionnel)"
            options={tasks.filter((t) => !mProject || t.project_id === mProject).map((t) => ({ value: t.id, label: `${t.title}${t.done ? " (terminée)" : ""}` }))}
            value={mTask}
            onChange={(e) => setMTask(e.target.value)}
            placeholder="Aucune"
          />
          <div className="grid grid-cols-3 gap-3">
            <Input label="Date" type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} />
            <Input label="Début" type="time" value={mStart} onChange={(e) => setMStart(e.target.value)} />
            <Input label="Durée" value={mDuration} onChange={(e) => setMDuration(e.target.value)} placeholder="1h30" />
          </div>
          <Input label="Description" value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="Ex: réunion client, dev module X..." />
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={mBillable} onChange={(e) => setMBillable(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
            Facturable au client
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setManualOpen(false)}>Annuler</Button>
            <Button className="flex-1" onClick={handleManual}>Enregistrer</Button>
          </div>
        </div>
      </Modal>

      {!loaded && null}
    </div>
  );
}
