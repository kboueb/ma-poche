import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectsStore } from "@/stores/useProjectsStore";
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
} from "lucide-react";
import { toast } from "sonner";
import TransactionForm from "@/features/transactions/TransactionForm";
import ProjectTasks from "./ProjectTasks";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import type { Project, ProjectStatus, MilestoneKind, Transaction } from "@/types";

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
  const navigate = useNavigate();

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
  const [saving, setSaving] = useState(false);

  // Formulaire jalon
  const [mTitle, setMTitle] = useState("");
  const [mKind, setMKind] = useState<MilestoneKind>("deadline");
  const [mDate, setMDate] = useState("");
  const [mAmount, setMAmount] = useState("");

  useEffect(() => { fetch(); fetchTx(); }, [fetch, fetchTx]);

  const switchView = (v: "grid" | "board") => {
    setView(v);
    try { localStorage.setItem(BOARD_VIEW_KEY, v); } catch { /* ignore */ }
  };

  const moveProject = async (id: string, status: ProjectStatus) => {
    const p = projects.find((x) => x.id === id);
    if (!p || p.status === status) return;
    await updateProject(id, { status });
    setDetailProject((d) => d && d.id === id ? { ...d, status } : d);
    toast.success(`Mission déplacée → ${STATUS_LABEL[status]}`);
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
      if (p.total_amount == null) return;
      const { income } = finances(p.id);
      outstanding += Math.max(Number(p.total_amount) - income, 0);
    });
    const overdue = activeProjects.filter((p) => isOverdue(p.deadline)).length +
      milestones.filter((m) => !m.done && isOverdue(m.due_date) &&
        projects.find((p) => p.id === m.project_id)?.status === "active").length;
    const pendingValidations = milestones.filter((m) => !m.done && m.kind === "validation").length;
    return { activeCount: activeProjects.length, outstanding, overdue, pendingValidations };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, milestones, transactions]);

  // ---- Projet : créer / éditer ----
  const openCreate = () => {
    setEditingProject(null);
    setFClient(""); setFName(""); setFStatus("active");
    setFAmount(""); setFRate(""); setFStart(""); setFDeadline(""); setFNotes("");
    setProjectModal(true);
  };

  const openEdit = (p: Project) => {
    setEditingProject(p);
    setFClient(p.client_name); setFName(p.name); setFStatus(p.status);
    setFAmount(p.total_amount != null ? String(p.total_amount) : "");
    setFRate(p.hourly_rate != null ? String(p.hourly_rate) : "");
    setFStart(p.start_date || ""); setFDeadline(p.deadline || "");
    setFNotes(p.notes || "");
    setProjectModal(true);
  };

  const saveProject = async () => {
    if (!fClient.trim() || !fName.trim()) {
      toast.error("Client et nom de mission requis");
      return;
    }
    setSaving(true);
    const payload = {
      client_name: fClient.trim(),
      name: fName.trim(),
      description: null,
      status: fStatus,
      total_amount: fAmount ? parseFloat(fAmount) : null,
      hourly_rate: fRate ? parseFloat(fRate) : null,
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
      await addProject(payload);
      toast.success("Mission créée");
    }
    setSaving(false);
    setProjectModal(false);
    setEditingProject(null);
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
            <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nouvelle mission</Button>
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
          onAction={openCreate}
        />
      ) : view === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-6 px-6 md:mx-0 md:px-0 md:grid md:grid-cols-4">
          {STATUS_ORDER.filter((s) => !statusFilter || s === statusFilter).map((status) => {
            const colProjects = filtered.filter((p) => p.status === status);
            const colTotal = colProjects.reduce((sum, p) => sum + (p.total_amount != null ? Number(p.total_amount) : 0), 0);
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
                  const total = p.total_amount != null ? Number(p.total_amount) : null;
                  const pct = total && total > 0 ? Math.min((income / total) * 100, 100) : null;
                  const late = p.status === "active" && isOverdue(p.deadline);
                  const openMs = milestones.filter((m) => m.project_id === p.id && !m.done).length;
                  const statusIdx = STATUS_ORDER.indexOf(p.status);
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
            const total = p.total_amount != null ? Number(p.total_amount) : null;
            const pct = total && total > 0 ? Math.min((income / total) * 100, 100) : null;
            const late = p.status === "active" && isOverdue(p.deadline);
            const openMs = milestones.filter((m) => m.project_id === p.id && !m.done).length;
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
          <Input label="Client" value={fClient} onChange={(e) => setFClient(e.target.value)} placeholder="Ex: Société Générale, Client X..." />
          <Input label="Nom de la mission" value={fName} onChange={(e) => setFName(e.target.value)} placeholder="Ex: Refonte portail, Audit..." />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Statut"
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value as ProjectStatus)}
            />
            <Input label="Montant forfait" type="number" step="1" value={fAmount} onChange={(e) => setFAmount(e.target.value)} placeholder="Optionnel" />
          </div>
          <Input label="Taux horaire (€/h)" type="number" step="1" value={fRate} onChange={(e) => setFRate(e.target.value)} placeholder="Ex : 75 — sert à valoriser le temps" />
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
          const total = detailProject.total_amount != null ? Number(detailProject.total_amount) : null;
          const remaining = total != null ? Math.max(total - income, 0) : null;
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
                <div className="flex-1" />
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
                hourlyRate={detailProject.hourly_rate != null ? Number(detailProject.hourly_rate) : null}
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
