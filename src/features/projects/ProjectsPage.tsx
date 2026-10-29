import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useClientsStore } from "@/stores/useClientsStore";
import { useTemplatesStore } from "@/stores/useTemplatesStore";
import { useTimeStore } from "@/stores/useTimeStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import {
  billingModeOf, budgetStatus, expectedRevenue, missionReview, projectMinutes, soldDailyRate, effectiveDailyRate,
  type BudgetStatus,
} from "@/lib/utils/missionMetrics";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate, formatDue } from "@/lib/utils/dates";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import {
  Plus, Briefcase, AlertTriangle, Check, Trash2, Edit2, X,
  CalendarClock, BadgeCheck, Banknote, Link2, Unlink, Receipt,
  LayoutGrid, SquareKanban, ChevronLeft, ChevronRight, GripVertical, ReceiptText,
  Gauge, BookmarkPlus, ClipboardCheck, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import TransactionForm from "@/features/transactions/TransactionForm";
import ProjectTasks from "./ProjectTasks";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import type { BillingMode, Project, ProjectStatus, MilestoneKind, Transaction } from "@/types";

const BILLING_LABEL: Record<BillingMode, string> = {
  fixed: "Forfait",
  daily: "Régie au TJM",
  hourly: "Taux horaire",
};

const BUDGET_STYLE: Record<BudgetStatus["level"], { bar: string; text: string }> = {
  ok: { bar: "bg-brand-500", text: "text-text-muted" },
  warning: { bar: "bg-amber-500", text: "text-amber-400" },
  over: { bar: "bg-rose-500", text: "text-rose-400" },
};

const fmtDays = (d: number) => `${String(Math.round(d * 10) / 10).replace(".", ",")} j`;

function BudgetBar({ status, compact = false }: { status: BudgetStatus; compact?: boolean }) {
  const style = BUDGET_STYLE[status.level];
  return (
    <div title={`Budget consommé : ${status.pct} %`}>
      <div className={`${compact ? "h-1" : "h-1.5"} bg-surface-3 rounded-full overflow-hidden`}>
        <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(status.pct, 100)}%` }} />
      </div>
      <div className={`flex justify-between text-[10px] mt-1 font-mono ${style.text}`}>
        <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{fmtDays(status.spentDays)} / {fmtDays(status.budgetDays)}</span>
        <span>{status.pct} %</span>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  prospect: "Prospect",
  active: "En cours",
  done: "Terminé",
  archived: "Archivé",
};

const STATUS_STYLE: Record<ProjectStatus, string> = {
  prospect: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  active: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  done: "bg-surface-3 text-text-secondary border-surface-4",
  archived: "bg-surface-2 text-text-muted border-surface-3",
};

const KIND_LABEL: Record<MilestoneKind, string> = {
  deadline: "Échéance",
  validation: "Validation",
  payment: "Paiement",
};

const STATUS_ORDER: ProjectStatus[] = ["prospect", "active", "done", "archived"];

const BOARD_VIEW_KEY = "mapoche-projects-view";

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toISOString().slice(0, 10));
}

export default function ProjectsPage() {
  const {
    projects, milestones, loading, schemaError, fetch,
    addProject, updateProject, removeProject,
    addMilestone, updateMilestone, removeMilestone,
  } = useProjectsStore();
  const { transactions, fetch: fetchTx, update: updateTx } = useTransactionsStore();
  const { accounts } = useAccountsStore();
  const { categories } = useCategoriesStore();
  const { clients, fetch: fetchClients, ensure: ensureClient, schemaError: clientsMissing } = useClientsStore();
  const { templates, fetch: fetchTemplates, apply: applyTemplate, saveFromProject, remove: removeTemplate } = useTemplatesStore();
  const { entries, loaded: timeLoaded, fetch: fetchTime } = useTimeStore();
  const hoursPerDay = useSettingsStore((s) => s.hoursPerDay);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [view, setView] = useState<"grid" | "board">(() => {
    try {
      return (localStorage.getItem(BOARD_VIEW_KEY) as "grid" | "board") || "board";
    } catch {
      return "board";
    }
  });
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<ProjectStatus | null>(null);
  const suppressClick = useRef(false);
  const [projectModal, setProjectModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detailProject, setDetailProject] = useState<Project | null>(null);
  const [linkingTx, setLinkingTx] = useState(false);
  const [txToLink, setTxToLink] = useState("");
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);

  // Formulaire projet
  const [fClient, setFClient] = useState("");
  const [fName, setFName] = useState("");
  const [fStatus, setFStatus] = useState<ProjectStatus>("active");
  const [fAmount, setFAmount] = useState("");
  const [fRate, setFRate] = useState("");
  const [fStart, setFStart] = useState("");
  const [fDeadline, setFDeadline] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [fClientId, setFClientId] = useState("");
  const [fBilling, setFBilling] = useState<BillingMode>("fixed");
  const [fDailyRate, setFDailyRate] = useState("");
  const [fBudgetDays, setFBudgetDays] = useState("");
  const [fRecurring, setFRecurring] = useState(false);
  const [fTemplate, setFTemplate] = useState("");
  const [saving, setSaving] = useState(false);

  // Formulaire jalon
  const [mTitle, setMTitle] = useState("");
  const [mKind, setMKind] = useState<MilestoneKind>("deadline");
  const [mDate, setMDate] = useState("");
  const [mAmount, setMAmount] = useState("");

  useEffect(() => {
    fetch(); fetchTx(); fetchClients(); fetchTemplates();
    if (!timeLoaded) fetchTime();
  }, [fetch, fetchTx, fetchClients, fetchTemplates, fetchTime, timeLoaded]);

  // Liens entrants : ?project=ID (ouvrir) ou ?client=ID (nouvelle mission pour ce client)
  useEffect(() => {
    const pid = searchParams.get("project");
    const cid = searchParams.get("client");
    if (pid) {
      const p = projects.find((x) => x.id === pid);
      if (!p) return;
      setDetailProject(p);
      setSearchParams({}, { replace: true });
    } else if (cid && clients.some((c) => c.id === cid)) {
      openCreate(cid);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, projects, clients]);

  const minutesByProject = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((p) => map.set(p.id, projectMinutes(p.id, entries)));
    return map;
  }, [projects, entries]);

  const budgetOf = (p: Project) => budgetStatus(p, minutesByProject.get(p.id) || 0, hoursPerDay);

  const switchView = (v: "grid" | "board") => {
    setView(v);
    try { localStorage.setItem(BOARD_VIEW_KEY, v); } catch { /* ignore */ }
  };

  const moveProject = async (id: string, status: ProjectStatus) => {
    const p = projects.find((x) => x.id === id);
    if (!p || p.status === status) return;
    await updateProject(id, { status });
    setDetailProject((d) => d && d.id === id ? { ...d, status } : d);
    if (status === "done") {
      toast.success("Mission terminée", {
        action: { label: "Voir le bilan", onClick: () => setDetailProject({ ...p, status }) },
      });
    } else {
      toast.success(`Mission déplacée → ${STATUS_LABEL[status]}`);
    }
  };

  const shiftProject = (p: Project, dir: -1 | 1) => {
    const idx = STATUS_ORDER.indexOf(p.status);
    const next = STATUS_ORDER[idx + dir];
    if (next) moveProject(p.id, next);
  };

  const filtered = useMemo(
    () => projects.filter((p) => !statusFilter || p.status === statusFilter),
    [projects, statusFilter]
  );

  const linkedTx = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    transactions.forEach((t) => {
      if (t.project_id) {
        const arr = map.get(t.project_id) || [];
        arr.push(t);
        map.set(t.project_id, arr);
      }
    });
    return map;
  }, [transactions]);

  const finances = (projectId: string) => {
    const txs = linkedTx.get(projectId) || [];
    const income = txs.filter((t) => t.flow === "income").reduce((s, t) => s + Number(t.amount), 0);
    const expense = txs.filter((t) => t.flow === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return { txs, income, expense, margin: income - expense };
  };

  // ---- Stats globales ----
  const stats = useMemo(() => {
    const activeProjects = projects.filter((p) => p.status === "active");
    let outstanding = 0;
    activeProjects.forEach((p) => {
      const expected = p.recurring_monthly ? null : expectedRevenue(p, hoursPerDay);
      if (expected == null) return;
      const { income } = finances(p.id);
      outstanding += Math.max(expected - income, 0);
    });
    const overdue = activeProjects.filter((p) => isOverdue(p.deadline)).length +
      milestones.filter((m) => !m.done && isOverdue(m.due_date) &&
        projects.find((p) => p.id === m.project_id)?.status === "active").length;
    const pendingValidations = milestones.filter((m) => !m.done && m.kind === "validation").length;
    const budgetAlerts = activeProjects.filter((p) => {
      const b = budgetOf(p);
      return b && b.level !== "ok";
    }).length;
    return { activeCount: activeProjects.length, outstanding, overdue, pendingValidations, budgetAlerts };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, milestones, transactions, minutesByProject, hoursPerDay]);

  // ---- Projet : créer / éditer ----
  const openCreate = (clientId = "") => {
    setEditingProject(null);
    const client = clients.find((c) => c.id === clientId);
    setFClientId(client?.id || ""); setFClient("");
    setFName(""); setFStatus("active");
    setFAmount(""); setFRate(""); setFStart(new Date().toISOString().slice(0, 10)); setFDeadline(""); setFNotes("");
    setFBilling(client?.default_daily_rate != null ? "daily" : "fixed");
    setFDailyRate(client?.default_daily_rate != null ? String(client.default_daily_rate) : "");
    setFBudgetDays(""); setFRecurring(false); setFTemplate("");
    setProjectModal(true);
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    const linked = p.client_id ? clients.find((c) => c.id === p.client_id) : null;
    setFClientId(linked?.id || ""); setFClient(linked ? "" : p.client_name);
    setFName(p.name); setFStatus(p.status);
    setFAmount(p.total_amount != null ? String(p.total_amount) : "");
    setFRate(p.hourly_rate != null ? String(p.hourly_rate) : "");
    setFBilling(billingModeOf(p));
    setFDailyRate(p.daily_rate != null ? String(p.daily_rate) : "");
    setFBudgetDays(p.budget_days != null ? String(p.budget_days) : "");
    setFRecurring(!!p.recurring_monthly);
    setFTemplate("");
    setFStart(p.start_date || ""); setFDeadline(p.deadline || "");
    setFNotes(p.notes || "");
    setProjectModal(true);
  };

  const parseNum = (v: string) => (v.trim() ? parseFloat(v.replace(",", ".")) : null);

  const saveProject = async () => {
    const selectedClient = clients.find((c) => c.id === fClientId);
    const clientName = selectedClient?.name || fClient.trim();
    if (!clientName || !fName.trim()) {
      toast.error("Client et nom de mission requis");
      return;
    }
    setSaving(true);
    const client = selectedClient || await ensureClient(clientName);
    const payload = {
      client_id: client?.id ?? null,
      client_name: client?.name || clientName,
      name: fName.trim(),
      description: null,
      status: fStatus,
      billing_mode: fBilling,
      total_amount: parseNum(fAmount),
      hourly_rate: fBilling === "hourly" ? parseNum(fRate) : null,
      daily_rate: fBilling === "hourly" ? null : parseNum(fDailyRate),
      budget_days: parseNum(fBudgetDays),
      recurring_monthly: fBilling !== "fixed" && fRecurring,
      start_date: fStart || null,
      deadline: fDeadline || null,
      color: editingProject?.color || "#6366f1",
      notes: fNotes || null,
    };
    if (editingProject) {
      await updateProject(editingProject.id, payload);
      setDetailProject((d) => d && d.id === editingProject.id ? { ...d, ...payload } : d);
      toast.success("Mission mise à jour");
    } else {
      const created = await addProject(payload);
      const template = templates.find((t) => t.id === fTemplate);
      if (created && template) {
        await applyTemplate(template, created, expectedRevenue(created, hoursPerDay));
        toast.success(`Mission créée depuis « ${template.name} »`);
      } else if (created) {
        toast.success("Mission créée");
      }
    }
    setSaving(false);
    setProjectModal(false);
    setEditingProject(null);
  };

  const saveAsTemplate = async (p: Project) => {
    const name = window.prompt("Nom du modèle", p.name);
    if (!name?.trim()) return;
    if (await saveFromProject(p, name.trim())) toast.success(`Modèle « ${name.trim()} » enregistré`);
  };

  // ---- Jalons ----
  const addNewMilestone = async () => {
    if (!detailProject || !mTitle.trim()) return;
    await addMilestone({
      project_id: detailProject.id,
      title: mTitle.trim(),
      kind: mKind,
      due_date: mDate || null,
      amount: mAmount ? parseFloat(mAmount) : null,
      done: false,
      done_at: null,
      notes: null,
    });
    setMTitle(""); setMDate(""); setMAmount(""); setMKind("deadline");
  };

  const toggleMilestone = async (id: string, done: boolean) => {
    await updateMilestone(id, {
      done: !done,
      done_at: !done ? new Date().toISOString().slice(0, 10) : null,
    });
  };

  // ---- Lier / délier transaction ----
  const linkTransaction = async () => {
    if (!detailProject || !txToLink) return;
    await updateTx(txToLink, { project_id: detailProject.id });
    setTxToLink("");
    setLinkingTx(false);
    toast.success("Transaction liée à la mission");
  };

  const unlinkTransaction = async (txId: string) => {
    await updateTx(txId, { project_id: null });
    toast.success("Transaction déliée");
  };

  const unlinkedTx = useMemo(
    () => transactions.filter((t) => !t.project_id && t.flow !== "transfer").slice(0, 60),
    [transactions]
  );

  const detailMilestones = detailProject
    ? milestones.filter((m) => m.project_id === detailProject.id)
    : [];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Missions"
        subtitle="Suivi de tes projets de consultance"
        actions={
          <>
            <Select
              options={[
                { value: "", label: "Tous les statuts" },
                { value: "prospect", label: "Prospects" },
                { value: "active", label: "En cours" },
                { value: "done", label: "Terminés" },
                { value: "archived", label: "Archivés" },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => openCreate()}>Nouvelle mission</Button>
          </>
        }
      />

      {/* Toggle Grille / Kanban */}
      <div className="flex items-center gap-2">
        <div className="grid grid-cols-2 gap-1 p-1 bg-surface-1 border border-surface-3 rounded-xl">
          <button
            onClick={() => switchView("grid")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === "grid" ? "bg-surface-3 text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
          >
            <LayoutGrid className="w-3.5 h-3.5" /> Grille
          </button>
          <button
            onClick={() => switchView("board")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${view === "board" ? "bg-surface-3 text-text-primary" : "text-text-muted hover:text-text-secondary"}`}
          >
            <SquareKanban className="w-3.5 h-3.5" /> Kanban
          </button>
        </div>
        {view === "board" && statusFilter && (
          <button onClick={() => setStatusFilter("")} className="text-xs text-brand-400 hover:underline">
            Voir toutes les colonnes
          </button>
        )}
      </div>

      {schemaError && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-xs text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>Tables Missions absentes : exécutez la migration <code className="font-mono">add_projects.sql</code> dans Supabase.</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5 text-brand-400" />En cours</p>
          <p className="text-xl font-bold font-mono">{stats.activeCount}</p>
          {stats.budgetAlerts > 0 && (
            <p className="text-[11px] text-amber-400 flex items-center gap-1"><Gauge className="w-3 h-3" />{stats.budgetAlerts} budget{stats.budgetAlerts > 1 ? "s" : ""} à surveiller</p>
          )}
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-emerald-400" />Reste à encaisser</p>
          <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(stats.outstanding)}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5 text-rose-400" />En retard</p>
          <p className={`text-xl font-bold font-mono ${stats.overdue > 0 ? "text-rose-400" : ""}`}>{stats.overdue}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><BadgeCheck className="w-3.5 h-3.5 text-amber-400" />Validations en attente</p>
          <p className="text-xl font-bold font-mono">{stats.pendingValidations}</p>
        </div>
      </div>

      {/* Liste projets : Grille ou Kanban */}
      {loading ? (
        <SkeletonCards count={4} cardClass="h-40" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="w-12 h-12" />}
          title="Aucune mission"
          description="Créez votre première mission pour suivre clients, temps et factures."
          actionLabel="Créer ma première mission"
          onAction={() => openCreate()}
        />
      ) : view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-4">
          {STATUS_ORDER.filter((s) => !statusFilter || s === statusFilter).map((status) => {
            const colProjects = filtered.filter((p) => p.status === status);
            const colTotal = colProjects.reduce((sum, p) => sum + (expectedRevenue(p, hoursPerDay) ?? 0), 0);
            return (
              <div
                key={status}
                onDragOver={(e) => { e.preventDefault(); setDropStatus(status); }}
                onDragLeave={() => setDropStatus((d) => d === status ? null : d)}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain");
                  setDropStatus(null);
                  setDraggedId(null);
                  if (id) moveProject(id, status);
                }}
                className={`flex-1 min-w-[240px] md:min-w-0 rounded-2xl p-2.5 space-y-2.5 transition-colors ${
                  dropStatus === status ? "bg-brand-500/10 border-2 border-dashed border-brand-500/50" : "bg-surface-1 border border-surface-3"
                }`}
              >
                <div className="px-1.5 pt-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[status]}`}>
                      {STATUS_LABEL[status]}
                    </span>
                    <span className="text-[11px] font-mono text-text-muted">{colProjects.length}</span>
                  </div>
                  {colTotal > 0 && (
                    <p className="text-[11px] font-mono text-text-muted mt-1">{formatCurrency(colTotal)}</p>
                  )}
                </div>

                {colProjects.map((p) => {
                  const { income } = finances(p.id);
                  const total = expectedRevenue(p, hoursPerDay);
                  const pct = total && total > 0 ? Math.min((income / total) * 100, 100) : null;
                  const late = p.status === "active" && isOverdue(p.deadline);
                  const openMs = milestones.filter((m) => m.project_id === p.id && !m.done).length;
                  const statusIdx = STATUS_ORDER.indexOf(p.status);
                  const budget = p.status === "active" ? budgetOf(p) : null;
                  return (
                    <div
                      key={p.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", p.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggedId(p.id);
                        suppressClick.current = true;
                      }}
                      onDragEnd={() => {
                        setDraggedId(null);
                        setDropStatus(null);
                        setTimeout(() => { suppressClick.current = false; }, 50);
                      }}
                      onClick={() => {
                        if (suppressClick.current) return;
                        setDetailProject(p);
                      }}
                      className={`bg-surface-2 border border-surface-4 rounded-xl p-3 space-y-2 cursor-grab active:cursor-grabbing hover:border-brand-500/30 transition-all ${
                        draggedId === p.id ? "opacity-40 scale-[0.98]" : ""
                      }`}
                    >
                      <div className="flex items-start gap-1.5">
                        <GripVertical className="w-3.5 h-3.5 text-text-muted shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] text-text-muted uppercase tracking-wider truncate">{p.client_name}</p>
                          <h4 className="text-sm font-bold truncate">{p.name}</h4>
                        </div>
                      </div>

                      {total != null && (
                        <div>
                          <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct || 0}%` }} />
                          </div>
                          <div className="flex justify-between text-[10px] mt-1 font-mono">
                            <span className="text-emerald-400">{formatCurrency(income)}</span>
                            <span className="text-text-muted">/ {formatCurrency(total)}</span>
                          </div>
                        </div>
                      )}

                      {budget && <BudgetBar status={budget} compact />}
                      {p.recurring_monthly && (
                        <p className="text-[10px] text-sky-400 flex items-center gap-1"><Repeat className="w-3 h-3" />Régie mensuelle</p>
                      )}

                      <div className="flex items-center justify-between">
                        <span className={`flex items-center gap-1 text-[10px] ${late ? "text-rose-400 font-semibold" : "text-text-muted"}`}>
                          <CalendarClock className="w-3 h-3" />
                          {p.deadline ? formatDue(p.deadline) : "—"}
                          {openMs > 0 && <span className="ml-1">· {openMs} ⏳</span>}
                        </span>
                        <span className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => shiftProject(p, -1)}
                            disabled={statusIdx === 0}
                            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 disabled:opacity-20 transition-colors"
                            title="Déplacer vers la gauche"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => shiftProject(p, 1)}
                            disabled={statusIdx === STATUS_ORDER.length - 1}
                            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 disabled:opacity-20 transition-colors"
                            title="Déplacer vers la droite"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}

                {colProjects.length === 0 && (
                  <p className="text-center text-[11px] text-text-muted py-6 border-2 border-dashed border-surface-3 rounded-xl">
                    Dépose une mission ici
                  </p>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((p) => {
            const { income } = finances(p.id);
            const total = expectedRevenue(p, hoursPerDay);
            const pct = total && total > 0 ? Math.min((income / total) * 100, 100) : null;
            const late = p.status === "active" && isOverdue(p.deadline);
            const openMs = milestones.filter((m) => m.project_id === p.id && !m.done).length;
            const budget = p.status === "active" ? budgetOf(p) : null;
            return (
              <div
                key={p.id}
                onClick={() => setDetailProject(p)}
                className="bg-surface-1 border border-surface-3 hover:border-brand-500/30 rounded-2xl p-5 space-y-3 cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] text-text-muted uppercase tracking-wider truncate">{p.client_name}</p>
                    <h3 className="font-bold truncate">{p.name}</h3>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[p.status]}`}>
                    {STATUS_LABEL[p.status]}
                  </span>
                </div>

                {total != null && (
                  <div>
                    <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct || 0}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] mt-1">
                      <span className="font-mono text-emerald-400">{formatCurrency(income)}</span>
                      <span className="text-text-muted font-mono">/ {formatCurrency(total)}</span>
                    </div>
                  </div>
                )}

                {budget && <BudgetBar status={budget} />}

                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span className={`flex items-center gap-1 ${late ? "text-rose-400 font-semibold" : ""}`}>
                    <CalendarClock className="w-3 h-3" />
                    {p.deadline ? formatDue(p.deadline) : "Pas d'échéance"}
                  </span>
                  {openMs > 0 && <span>{openMs} jalon{openMs > 1 ? "s" : ""} ouvert{openMs > 1 ? "s" : ""}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal création / édition projet */}
      <Modal
        isOpen={projectModal}
        onClose={() => { setProjectModal(false); setEditingProject(null); }}
        title={editingProject ? "Modifier la mission" : "Nouvelle mission"}
        size="sm"
      >
        <div className="space-y-4">
          {clients.length > 0 && !clientsMissing ? (
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Client"
                options={clients.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Nouveau client…"
                value={fClientId}
                onChange={(e) => {
                  setFClientId(e.target.value);
                  const c = clients.find((x) => x.id === e.target.value);
                  if (c?.default_daily_rate != null && !fDailyRate) setFDailyRate(String(c.default_daily_rate));
                }}
              />
              {!fClientId && (
                <Input label="Nom du client" value={fClient} onChange={(e) => setFClient(e.target.value)} placeholder="Créé à l'enregistrement" />
              )}
            </div>
          ) : (
            <Input label="Client" value={fClient} onChange={(e) => setFClient(e.target.value)} placeholder="Ex: Société Générale, Client X..." />
          )}
          <Input label="Nom de la mission" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Ex: Refonte portail, Audit..." />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Statut"
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value as ProjectStatus)}
            />
            <Select
              label="Facturation"
              options={Object.entries(BILLING_LABEL).map(([value, label]) => ({ value, label }))}
              value={fBilling}
              onChange={(e) => setFBilling(e.target.value as BillingMode)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            {fBilling === "hourly" ? (
              <Input label="Taux horaire" type="number" step="1" value={fRate} onChange={(e) => setFRate(e.target.value)} placeholder="Ex : 75" />
            ) : (
              <Input
                label={fBilling === "daily" ? "TJM" : "TJM de référence"}
                type="number" step="1" value={fDailyRate} onChange={(e) => setFDailyRate(e.target.value)}
                placeholder={fBilling === "daily" ? "Ex : 600" : "Optionnel"}
              />
            )}
            {fBilling === "fixed" ? (
              <Input label="Montant forfait" type="number" step="1" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="Optionnel" />
            ) : (
              <Input
                label={fRecurring ? "Jours / mois" : "Jours vendus"}
                type="number" step="0.5" value={fBudgetDays} onChange={(e) => setFBudgetDays(e.target.value)}
                placeholder={fRecurring ? "Ex : 8" : "Ex : 15"}
              />
            )}
          </div>
          {fBilling === "fixed" ? (
            <Input
              label="Budget en jours"
              type="number" step="0.5" value={fBudgetDays} onChange={(e) => setFBudgetDays(e.target.value)}
              placeholder={fAmount && fDailyRate ? `Déduit : ${Math.round((parseFloat(fAmount) / parseFloat(fDailyRate)) * 10) / 10} j` : "Pour suivre le temps consommé"}
            />
          ) : (
            <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={fRecurring} onChange={(e) => setFRecurring(e.target.checked)} className="accent-brand-500" />
              Régie mensuelle : facturer chaque mois le temps passé
            </label>
          )}
          {!editingProject && templates.length > 0 && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Select
                  label="Modèle"
                  options={templates.map((t) => ({ value: t.id, label: `${t.name} (${t.tasks.length} tâches, ${t.milestones.length} jalons)` }))}
                  placeholder="Aucun"
                  value={fTemplate}
                  onChange={(e) => {
                    setFTemplate(e.target.value);
                    const t = templates.find((x) => x.id === e.target.value);
                    if (t?.billing_mode) setFBilling(t.billing_mode);
                  }}
                />
              </div>
              {fTemplate && (
                <button
                  onClick={() => {
                    const t = templates.find((x) => x.id === fTemplate);
                    if (t && window.confirm(`Supprimer le modèle « ${t.name} » ?`)) { removeTemplate(t.id); setFTemplate(""); }
                  }}
                  className="p-2.5 text-text-muted hover:text-rose-400" title="Supprimer ce modèle"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label="Début" type="date" value={fStart} onChange={(e) => setFStart(e.target.value)} />
            <Input label="Échéance" type="date" value={fDeadline} onChange={(e) => setFDeadline(e.target.value)} />
          </div>
          <Input label="Notes" value={fNotes} onChange={(e) => setFNotes(e.target.value)} placeholder="Contexte, contacts..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setProjectModal(false); setEditingProject(null); }}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={saveProject}>{editingProject ? "Mettre à jour" : "Créer"}</Button>
          </div>
        </div>
      </Modal>

      {/* Modal détail mission */}
      <Modal
        isOpen={!!detailProject}
        onClose={() => { setDetailProject(null); setLinkingTx(false); }}
        title={detailProject ? `${detailProject.client_name} — ${detailProject.name}` : ""}
        size="lg"
      >
        {detailProject && (() => {
          const { txs, income, expense, margin } = finances(detailProject.id);
          const expected = expectedRevenue(detailProject, hoursPerDay);
          const remaining = expected != null ? Math.max(expected - income, 0) : null;
          const minutes = minutesByProject.get(detailProject.id) || 0;
          const budget = budgetOf(detailProject);
          const soldRate = soldDailyRate(detailProject, hoursPerDay);
          const realRate = effectiveDailyRate(income, minutes, hoursPerDay);
          const mode = billingModeOf(detailProject);
          const review = detailProject.status === "done" || detailProject.status === "archived"
            ? missionReview(detailProject, { income, expense, minutes, milestones, entries }, hoursPerDay)
            : null;
          const client = detailProject.client_id ? clients.find((c) => c.id === detailProject.client_id) : null;
          const effectiveHourly = detailProject.hourly_rate != null
            ? Number(detailProject.hourly_rate)
            : detailProject.daily_rate != null ? Number(detailProject.daily_rate) / hoursPerDay : null;
          return (
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[detailProject.status]}`}>
                  {STATUS_LABEL[detailProject.status]}
                </span>
                {detailProject.deadline && (
                  <span className={`text-[11px] ${isOverdue(detailProject.deadline) && detailProject.status === "active" ? "text-rose-400 font-semibold" : "text-text-muted"}`}>
                    Échéance : {formatDate(detailProject.deadline, "d MMM yyyy")}
                  </span>
                )}
                <span className="text-[11px] text-text-muted flex items-center gap-1">
                  {detailProject.recurring_monthly && <Repeat className="w-3 h-3 text-sky-400" />}
                  {BILLING_LABEL[mode]}{detailProject.recurring_monthly ? " mensuelle" : ""}
                </span>
                {client && (
                  <button onClick={() => navigate("/clients")} className="text-[11px] text-brand-400 hover:underline">
                    Fiche {client.name}
                  </button>
                )}
                <div className="flex-1" />
                <button onClick={() => saveAsTemplate(detailProject)} className="p-2 text-text-muted hover:text-brand-400" title="Enregistrer comme modèle">
                  <BookmarkPlus className="w-4 h-4" />
                </button>
                <button onClick={() => { setDetailProject(null); openEdit(detailProject); }} className="p-2 text-text-muted hover:text-brand-400" title="Modifier">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { removeProject(detailProject.id); setDetailProject(null); toast.success("Mission supprimée"); }}
                  className="p-2 text-text-muted hover:text-rose-400" title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {detailProject.notes && <p className="text-sm text-text-secondary">{detailProject.notes}</p>}

              {/* Bilan de fin de mission */}
              {review && (
                <div className="rounded-2xl border border-brand-500/30 bg-brand-500/5 p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-400 flex items-center gap-1.5">
                    <ClipboardCheck className="w-3.5 h-3.5" /> Bilan prévu vs réel
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-text-muted">Jours</p>
                      <p className="font-mono font-bold">
                        {fmtDays(review.spentDays)}{review.plannedDays != null && <span className="text-text-muted font-normal"> / {fmtDays(review.plannedDays)}</span>}
                      </p>
                      {review.daysDelta != null && review.daysDelta !== 0 && (
                        <p className={`font-mono text-[11px] ${review.daysDelta > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {review.daysDelta > 0 ? "+" : "−"}{fmtDays(Math.abs(review.daysDelta))}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-text-muted">TJM réel</p>
                      <p className="font-mono font-bold">{review.effectiveRate != null ? formatCurrency(review.effectiveRate) : "—"}</p>
                      {review.rateDelta != null && (
                        <p className={`font-mono text-[11px] ${review.rateDelta < 0 ? "text-rose-400" : "text-emerald-400"}`}>
                          {review.rateDelta >= 0 ? "+" : "−"}{formatCurrency(Math.abs(review.rateDelta))} vs vendu
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-text-muted">Encaissé</p>
                      <p className="font-mono font-bold text-emerald-400">{formatCurrency(review.income)}</p>
                      {review.expected != null && (
                        <p className="font-mono text-[11px] text-text-muted">sur {formatCurrency(review.expected)}</p>
                      )}
                    </div>
                    <div>
                      <p className="text-text-muted">Délai</p>
                      <p className={`font-mono font-bold ${review.lateDays != null && review.lateDays > 0 ? "text-rose-400" : ""}`}>
                        {review.lateDays == null ? "—" : review.lateDays > 0 ? `+${review.lateDays} j` : "Dans les temps"}
                      </p>
                      {review.finishedOn && <p className="text-[11px] text-text-muted">fini le {formatDate(review.finishedOn, "d MMM")}</p>}
                    </div>
                  </div>
                  {review.rateDelta != null && review.rateDelta < 0 && review.soldRate != null && (
                    <p className="text-[11px] text-text-secondary">
                      Pour retrouver ton TJM de {formatCurrency(review.soldRate)}, une mission similaire aurait dû être chiffrée
                      {" "}<b className="font-mono">{formatCurrency(review.soldRate * review.spentDays)}</b>.
                    </p>
                  )}
                </div>
              )}

              {/* Rentabilité */}
              {!review && (soldRate != null || budget || minutes > 0) && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
                    <Gauge className="w-3.5 h-3.5" /> Rentabilité
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-surface-2 rounded-xl p-3">
                      <p className="text-[10px] text-text-muted uppercase">TJM vendu</p>
                      <p className="text-sm font-mono font-bold">{soldRate != null ? formatCurrency(soldRate) : "—"}</p>
                    </div>
                    <div className="bg-surface-2 rounded-xl p-3" title="Encaissé ÷ jours passés">
                      <p className="text-[10px] text-text-muted uppercase">TJM réel</p>
                      <p className={`text-sm font-mono font-bold ${realRate != null && soldRate != null && realRate < soldRate ? "text-amber-400" : "text-emerald-400"}`}>
                        {realRate != null ? formatCurrency(realRate) : "—"}
                      </p>
                    </div>
                    <div className="bg-surface-2 rounded-xl p-3">
                      <p className="text-[10px] text-text-muted uppercase">Temps passé</p>
                      <p className="text-sm font-mono font-bold">{fmtDays(minutes / 60 / hoursPerDay)}</p>
                    </div>
                  </div>
                  {budget && (
                    <div className="mt-2">
                      <BudgetBar status={budget} />
                      {budget.level !== "ok" && (
                        <p className={`text-[11px] mt-1 ${BUDGET_STYLE[budget.level].text}`}>
                          {budget.level === "over"
                            ? "Budget dépassé : chaque jour de plus fait baisser ton TJM réel. Un avenant ?"
                            : `Plus que ${fmtDays(budget.remainingDays)} de budget.`}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Finances */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Finances</h4>
                  <button
                    onClick={() => { setDetailProject(null); navigate(`/factures?project=${detailProject.id}`); }}
                    className="flex items-center gap-1 text-xs text-brand-400 hover:underline"
                  >
                    <ReceiptText className="w-3.5 h-3.5" /> Facturer
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-surface-2 rounded-xl p-3">
                    <p className="text-[10px] text-text-muted uppercase">Encaissé</p>
                    <p className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(income)}</p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-3">
                    <p className="text-[10px] text-text-muted uppercase">Dépensé</p>
                    <p className="text-sm font-mono font-bold text-rose-400">{formatCurrency(expense)}</p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-3">
                    <p className="text-[10px] text-text-muted uppercase">Marge</p>
                    <p className={`text-sm font-mono font-bold ${margin >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(margin)}</p>
                  </div>
                  <div className="bg-surface-2 rounded-xl p-3">
                    <p className="text-[10px] text-text-muted uppercase">Reste à recevoir</p>
                    <p className="text-sm font-mono font-bold">{remaining != null ? formatCurrency(remaining) : "—"}</p>
                  </div>
                </div>

                <div className="mt-2 space-y-1.5">
                  {txs.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-2 text-xs">
                      <span className={`font-mono font-bold ${t.flow === "income" ? "text-emerald-400" : "text-rose-400"}`}>
                        {t.flow === "income" ? "+" : "−"}{formatCurrency(Number(t.amount))}
                      </span>
                      <span className="flex-1 truncate text-text-secondary">{t.description || t.category?.name || formatDate(t.date, "d MMM")}</span>
                      <button
                        onClick={() => setEditingTx(t)}
                        className="p-1 text-text-muted hover:text-brand-400" title="Ouvrir (justificatifs)"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => unlinkTransaction(t.id)} className="p-1 text-text-muted hover:text-rose-400" title="Délier">
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {linkingTx ? (
                    <div className="flex gap-2">
                      <Select
                        options={unlinkedTx.map((t) => ({
                          value: t.id,
                          label: `${t.flow === "income" ? "+" : "−"}${formatCurrency(Number(t.amount))} · ${t.description || t.category?.name || "?"} · ${formatDate(t.date, "d MMM")}`,
                        }))}
                        value={txToLink}
                        onChange={(e) => setTxToLink(e.target.value)}
                        placeholder="Choisir une transaction..."
                      />
                      <Button size="sm" onClick={linkTransaction}>Lier</Button>
                      <Button size="sm" variant="ghost" onClick={() => setLinkingTx(false)}><X className="w-4 h-4" /></Button>
                    </div>
                  ) : (
                    <button onClick={() => setLinkingTx(true)} className="flex items-center gap-1.5 text-xs text-brand-400 hover:underline">
                      <Link2 className="w-3.5 h-3.5" /> Lier un paiement / une dépense
                    </button>
                  )}
                </div>
              </div>

              {/* Jalons */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Échéances & validations</h4>
                <div className="space-y-1.5">
                  {detailMilestones.map((m) => (
                    <div key={m.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs group ${m.done ? "bg-surface-2 opacity-60" : "bg-surface-2"}`}>
                      <button
                        onClick={() => toggleMilestone(m.id, m.done)}
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${m.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-surface-4 hover:border-emerald-500"}`}
                      >
                        {m.done && <Check className="w-3 h-3" />}
                      </button>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold shrink-0 ${m.kind === "validation" ? "bg-amber-500/10 text-amber-400" : m.kind === "payment" ? "bg-emerald-500/10 text-emerald-400" : "bg-brand-500/10 text-brand-400"}`}>
                        {KIND_LABEL[m.kind]}
                      </span>
                      <span className={`flex-1 truncate ${m.done ? "line-through text-text-muted" : ""}`}>{m.title}</span>
                      {m.amount != null && <span className="font-mono text-text-muted shrink-0">{formatCurrency(Number(m.amount))}</span>}
                      {m.due_date && (
                        <span
                          title={formatDate(m.due_date, "d MMM yyyy")}
                          className={`shrink-0 ${!m.done && isOverdue(m.due_date) ? "text-rose-400 font-semibold" : "text-text-muted"}`}
                        >
                          {formatDue(m.due_date)}
                        </span>
                      )}
                      <button onClick={() => removeMilestone(m.id)} className="p-1 text-text-muted hover:text-rose-400 md:opacity-0 md:group-hover:opacity-100" title="Supprimer">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-col sm:flex-row gap-2 mt-2">
                  <input
                    value={mTitle}
                    onChange={(e) => setMTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") addNewMilestone(); }}
                    placeholder="Nouveau jalon : devis validé, livraison V1..."
                    className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                  <div className="flex gap-2">
                    <Select
                      options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
                      value={mKind}
                      onChange={(e) => setMKind(e.target.value as MilestoneKind)}
                    />
                    <Input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)} className="w-36" />
                    <Button size="sm" onClick={addNewMilestone}>Ajouter</Button>
                  </div>
                </div>
              </div>

              {/* Tâches & temps */}
              <ProjectTasks
                projectId={detailProject.id}
                hourlyRate={effectiveHourly}
              />
            </div>
          );
        })()}
      </Modal>

      {/* Modal édition transaction (justificatifs) */}
      <Modal isOpen={!!editingTx} onClose={() => { setEditingTx(null); fetchTx(); }} title="Transaction liée">
        {editingTx && (
          <TransactionForm
            onClose={() => { setEditingTx(null); fetchTx(); }}
            accounts={accounts}
            categories={categories}
            initialData={editingTx}
          />
        )}
      </Modal>
    </div>
  );
}
