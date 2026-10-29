import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useInvoicesStore } from "@/stores/useInvoicesStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useTimeStore } from "@/stores/useTimeStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { formatDuration, entryMinutes } from "@/lib/utils/time";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import {
  Plus, FileText, Trash2, Printer, Check, Send, XCircle, Banknote, AlertTriangle, Calendar, Clock, Mail, Repeat,
} from "lucide-react";
import { toast } from "sonner";
import type { Invoice, InvoiceStatus, InvoicePayment } from "@/types";
import { splitByPercent, percentsAreComplete, isPaymentOverdue, summarizePayments } from "@/lib/utils/invoicePayments";
import { buildDunningMailto } from "@/lib/utils/reminders";
import { openExternal } from "@/lib/tauri";
import { useClientsStore, clientDetailsText } from "@/stores/useClientsStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { monthlyBillingCandidates, previousMonth, timeBillingLine } from "@/lib/utils/missionMetrics";

const ISSUER_KEY = "mapoche-invoice-issuer";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyée",
  paid: "Payée",
  cancelled: "Annulée",
};

function totals(items: Array<{ quantity: number; unit_price: number }>, vatRate: number) {
  const ht = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0);
  const tva = ht * (Number(vatRate) / 100);
  return { ht, tva, ttc: ht + tva };
}

function loadIssuer(): { name: string; details: string } {
  try {
    return JSON.parse(localStorage.getItem(ISSUER_KEY) || '{"name":"","details":""}');
  } catch {
    return { name: "", details: "" };
  }
}

export default function InvoicesPage() {
  const { invoices, loading, schemaError, fetch, create, updateStatus, remove, addItem, removeItem, markInvoicePaid, markPaymentPaid, addPayment, removePayment } = useInvoicesStore();
  const { projects, milestones, fetch: fetchProjects, updateMilestone } = useProjectsStore();
  const { clients, fetch: fetchClients } = useClientsStore();
  const hoursPerDay = useSettingsStore((s) => s.hoursPerDay);
  const [regieMonth, setRegieMonth] = useState<string | null>(null);
  const [regieBusy, setRegieBusy] = useState(false);
  const [milestoneIds, setMilestoneIds] = useState<string[]>([]);
  const { entries, loaded: timeLoaded, fetch: fetchTime } = useTimeStore();
  const { accounts, fetch: fetchAcc } = useAccountsStore();

  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [payAccount, setPayAccount] = useState("");
  const [payingPaymentId, setPayingPaymentId] = useState<string | null>(null);

  // Formulaire création
  const [cProject, setCProject] = useState("");
  const [cIssue, setCIssue] = useState(new Date().toISOString().slice(0, 10));
  const [cDue, setCDue] = useState("");
  const [cVat, setCVat] = useState("0");
  const [cNotes, setCNotes] = useState("");
  const [cIssuerName, setCIssuerName] = useState("");
  const [cIssuerDetails, setCIssuerDetails] = useState("");
  const [cClientDetails, setCClientDetails] = useState("");
  const [cPaymentTerms, setCPaymentTerms] = useState("");
  const [cPayments, setCPayments] = useState<Array<{ label: string; percent: string; due_date: string }>>([]);
  const [includeTime, setIncludeTime] = useState(true);
  const [includeFixed, setIncludeFixed] = useState(false);
  const [freeLines, setFreeLines] = useState<Array<{ label: string; qty: string; price: string }>>([]);
  // Ajout ligne (détail, brouillon)
  const [nLabel, setNLabel] = useState("");
  const [nQty, setNQty] = useState("1");
  const [nPrice, setNPrice] = useState("");
  // Ajout échéance (détail)
  const [npLabel, setNpLabel] = useState("");
  const [npAmount, setNpAmount] = useState("");
  const [npDue, setNpDue] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    fetch(); fetchProjects(); fetchAcc(); fetchClients();
    if (!timeLoaded) fetchTime();
    const iss = loadIssuer();
    setCIssuerName(iss.name); setCIssuerDetails(iss.details);
  }, [fetch, fetchProjects, fetchAcc, fetchClients, fetchTime, timeLoaded]);

  // Pré-sélection depuis une mission (?project=ID) ou facturation de régie (?regie=AAAA-MM)
  useEffect(() => {
    const pid = searchParams.get("project");
    const regie = searchParams.get("regie");
    if (pid && projects.some((p) => p.id === pid)) {
      selectProject(pid);
      setCreateOpen(true);
      setSearchParams({}, { replace: true });
    } else if (regie && /^\d{4}-\d{2}$/.test(regie)) {
      setRegieMonth(regie);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, projects, setSearchParams]);

  const clientOf = (projectId: string) => {
    const p = projects.find((x) => x.id === projectId);
    return p?.client_id ? clients.find((c) => c.id === p.client_id) || null : null;
  };

  /** Choisit la mission et pré-remplit coordonnées client et échéance depuis la fiche client. */
  const selectProject = (pid: string) => {
    setCProject(pid);
    setMilestoneIds([]);
    const client = pid ? clientOf(pid) : null;
    if (!client) return;
    const details = clientDetailsText(client);
    if (details) setCClientDetails(details);
    if (client.payment_terms_days != null) {
      const d = new Date(`${cIssue}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + client.payment_terms_days);
      setCDue(d.toISOString().slice(0, 10));
    }
  };

  // Paiements prévus (acompte, jalons) de la mission, non encore réglés
  const billableMilestones = cProject
    ? milestones.filter((m) => m.project_id === cProject && m.kind === "payment" && !m.done && m.amount != null)
    : [];

  const regieCandidates = useMemo(
    () => (regieMonth ? monthlyBillingCandidates(projects, entries, regieMonth, hoursPerDay) : []),
    [regieMonth, projects, entries, hoursPerDay],
  );

  const lastMonthRegie = useMemo(
    () => monthlyBillingCandidates(projects, entries, previousMonth(today), hoursPerDay),
    [projects, entries, today, hoursPerDay],
  );

  const createRegieInvoices = async () => {
    if (!regieMonth) return;
    setRegieBusy(true);
    const issuer = loadIssuer();
    const monthLabel = formatDate(`${regieMonth}-01`, "MMMM yyyy");
    for (const c of regieCandidates) {
      if (!c.line) continue;
      const client = clientOf(c.project.id);
      const due = new Date(`${today}T00:00:00Z`);
      due.setUTCDate(due.getUTCDate() + (client?.payment_terms_days ?? 30));
      await create({
        project_id: c.project.id,
        issue_date: today,
        due_date: due.toISOString().slice(0, 10),
        vat_rate: 0,
        notes: `Prestations de ${monthLabel}`,
        issuer_name: issuer.name || null,
        issuer_details: issuer.details || null,
        client_details: client ? clientDetailsText(client) || null : null,
        payment_terms: null,
        items: [{ ...c.line, label: `${c.line.label} — ${monthLabel}`, kind: "time" }],
        entryIds: c.entryIds,
      });
    }
    setRegieBusy(false);
    setRegieMonth(null);
    setStatusFilter("draft");
  };

  const filtered = useMemo(
    () => invoices.filter((i) => !statusFilter || i.status === statusFilter),
    [invoices, statusFilter]
  );

  const unbilled = (projectId: string) =>
    entries.filter((e) => e.project_id === projectId && !e.invoice_id && e.ended_at && e.billable);

  const unbilledMinutes = (projectId: string) =>
    unbilled(projectId).reduce((s, e) => s + entryMinutes(e.started_at, e.ended_at, e.duration_minutes), 0);

  const selectedProject = projects.find((p) => p.id === cProject);
  const previewItems = useMemo(() => {
    const items: Array<{ label: string; quantity: number; unit_price: number }> = [];
    if (cProject && includeTime && selectedProject) {
      const line = timeBillingLine(selectedProject, unbilledMinutes(cProject), hoursPerDay);
      if (line) items.push(line);
    }
    if (cProject && includeFixed && selectedProject?.total_amount != null) {
      items.push({ label: `Forfait — ${selectedProject.name}`, quantity: 1, unit_price: Number(selectedProject.total_amount) });
    }
    billableMilestones.filter((m) => milestoneIds.includes(m.id)).forEach((m) => {
      items.push({ label: m.title, quantity: 1, unit_price: Number(m.amount) });
    });
    freeLines.forEach((l) => {
      if (l.label.trim() && parseFloat(l.price) > 0) {
        items.push({ label: l.label.trim(), quantity: parseFloat(l.qty) || 1, unit_price: parseFloat(l.price) });
      }
    });
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cProject, includeTime, includeFixed, freeLines, entries, projects, milestones, milestoneIds, hoursPerDay]);

  const previewTotals = totals(previewItems, parseFloat(cVat) || 0);
  const paymentTerms = cPayments.map((p) => ({ label: p.label.trim(), percent: parseFloat(p.percent) || 0, due_date: p.due_date || null }));
  const termsComplete = cPayments.length === 0 || percentsAreComplete(paymentTerms);
  const previewPayments = cPayments.length > 0 ? splitByPercent(previewTotals.ttc, paymentTerms) : [];

  const handleCreate = async () => {
    if (previewItems.length === 0) { toast.error("Ajoute au moins une ligne"); return; }
    if (paymentTerms.some((t) => !t.label || t.percent <= 0)) { toast.error("Chaque échéance doit avoir un libellé et un pourcentage"); return; }
    if (!termsComplete) { toast.error("Les échéances doivent totaliser 100 %"); return; }
    setSaving(true);
    const entryIds = cProject && includeTime
      ? unbilled(cProject).map((e) => e.id)
      : [];
    try {
      localStorage.setItem(ISSUER_KEY, JSON.stringify({ name: cIssuerName, details: cIssuerDetails }));
    } catch { /* ignore */ }
    await create({
      project_id: cProject || null,
      issue_date: cIssue,
      due_date: cDue || null,
      vat_rate: parseFloat(cVat) || 0,
      notes: cNotes || null,
      issuer_name: cIssuerName || null,
      issuer_details: cIssuerDetails || null,
      client_details: cClientDetails || null,
      payment_terms: cPaymentTerms || null,
      items: previewItems.map((i) => ({ ...i, kind: "other" as const })),
      payments: previewPayments,
      entryIds,
    });
    // Jalons facturés : cochés comme faits
    for (const id of milestoneIds) await updateMilestone(id, { done: true, done_at: today });
    setMilestoneIds([]);
    setSaving(false);
    setCreateOpen(false);
    setCProject(""); setCDue(""); setCVat("0"); setCNotes(""); setCClientDetails("");
    setCPaymentTerms(""); setCPayments([]);
    setFreeLines([]); setIncludeFixed(false);
  };

  const stats = useMemo(() => {
    const sent = invoices.filter((i) => i.status === "sent");
    const sentTotal = sent.reduce((s, i) => s + totals(i.items || [], Number(i.vat_rate)).ttc, 0);
    const nowMonth = new Date().toISOString().slice(0, 7);
    const paidMonth = invoices
      .filter((i) => i.status === "paid" && (i.paid_at || "").startsWith(nowMonth))
      .reduce((s, i) => s + totals(i.items || [], Number(i.vat_rate)).ttc, 0);
    return {
      draft: invoices.filter((i) => i.status === "draft").length,
      sentCount: sent.length,
      sentTotal,
      paidMonth,
    };
  }, [invoices]);

  const detailTotals = detail ? totals(detail.items || [], Number(detail.vat_rate)) : null;
  const liveDetail = detail ? invoices.find((i) => i.id === detail.id) || detail : null;

  const handlePrint = () => window.print();

  const handleMarkPaid = async () => {
    if (!liveDetail || !detailTotals) return;
    if (!payAccount) { toast.error("Choisis le compte d'encaissement"); return; }
    await markInvoicePaid(liveDetail, payAccount, detailTotals.ttc);
    setDetail(null);
    setPayAccount("");
  };

  const handleMarkPaymentPaid = async (payment: InvoicePayment) => {
    if (!liveDetail) return;
    if (!payAccount) { toast.error("Choisis le compte d'encaissement"); return; }
    setPayingPaymentId(payment.id);
    await markPaymentPaid(payment.id, payAccount);
    setPayingPaymentId(null);
  };

  const handleAddPayment = async () => {
    if (!liveDetail) return;
    const amount = parseFloat(npAmount);
    if (!npLabel.trim() || !(amount > 0)) { toast.error("Libellé + montant requis"); return; }
    await addPayment(liveDetail.id, { label: npLabel.trim(), amount_due: amount, due_date: npDue || null });
    setNpLabel(""); setNpAmount(""); setNpDue("");
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Factures"
        subtitle={`${invoices.length} facture${invoices.length > 1 ? "s" : ""} · ${formatCurrency(stats.sentTotal)} en attente`}
        actions={
          <>
            <Select
              options={[
                { value: "", label: "Tous statuts" },
                { value: "draft", label: "Brouillons" },
                { value: "sent", label: "Envoyées" },
                { value: "paid", label: "Payées" },
                { value: "cancelled", label: "Annulées" },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>Nouvelle facture</Button>
          </>
        }
      />

      {schemaError && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-xs text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>Tables Factures absentes : exécutez la migration <code className="font-mono">add_invoices.sql</code> dans Supabase, puis rechargez la page.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Brouillons</p>
          <p className="text-xl font-bold font-mono">{stats.draft}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">En attente ({stats.sentCount})</p>
          <p className="text-xl font-bold font-mono text-amber-400">{formatCurrency(stats.sentTotal)}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1">Encaissé (mois)</p>
          <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(stats.paidMonth)}</p>
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={4} rowClass="h-16 rounded-2xl" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="Aucune facture"
          description="Créez votre première facture depuis une mission pour suivre vos paiements clients."
          actionLabel="Créer ma première facture"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <div className="bg-surface-1 border border-surface-3 rounded-2xl divide-y divide-surface-3 overflow-hidden">
          {filtered.map((inv) => {
            const t = totals(inv.items || [], Number(inv.vat_rate));
            const overdue = inv.status === "sent" && inv.due_date && new Date(inv.due_date) < new Date(new Date().toISOString().slice(0, 10));
            return (
              <div key={inv.id} onClick={() => setDetail(inv)} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 cursor-pointer transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold font-mono">{inv.number}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    {inv.project ? `${inv.project.client_name} — ${inv.project.name}` : "Sans mission"} · {formatDate(inv.issue_date, "d MMM yyyy")}
                  </p>
                </div>
                {(inv.payments || []).length > 0 && inv.status === "sent" && (
                  <span className="text-[11px] font-mono text-text-muted shrink-0">
                    {(inv.payments || []).filter((p) => p.status === "paid").length}/{(inv.payments || []).length} payées
                  </span>
                )}
                <p className="text-sm font-mono font-bold shrink-0">{formatCurrency(t.ttc)}</p>
                <Badge variant={inv.status === "paid" ? "success" : inv.status === "sent" ? (overdue ? "danger" : "warning") : inv.status === "cancelled" ? "neutral" : "info"}>
                  {overdue ? "En retard" : STATUS_LABEL[inv.status]}
                </Badge>
              </div>
            );
          })}
        </div>
      )}

      {lastMonthRegie.length > 0 && (
        <button
          onClick={() => setRegieMonth(previousMonth(today))}
          className="w-full flex items-center gap-2 bg-sky-500/10 border border-sky-500/30 rounded-2xl px-4 py-3 text-xs text-sky-400 text-left hover:bg-sky-500/15"
        >
          <Repeat className="w-4 h-4 shrink-0" />
          <span className="flex-1">
            {lastMonthRegie.length} mission{lastMonthRegie.length > 1 ? "s" : ""} en régie à facturer pour {formatDate(`${previousMonth(today)}-01`, "MMMM")}
          </span>
          <span className="font-semibold">Préparer les factures →</span>
        </button>
      )}

      {/* Régie : factures mensuelles */}
      <Modal isOpen={!!regieMonth} onClose={() => setRegieMonth(null)} title={regieMonth ? `Régie — ${formatDate(`${regieMonth}-01`, "MMMM yyyy")}` : ""}>
        <div className="space-y-4">
          {regieCandidates.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-6">Aucun temps facturable non facturé sur ce mois pour les missions en régie.</p>
          ) : (
            <>
              <p className="text-xs text-text-secondary">Un brouillon par mission, avec le temps du mois au TJM (ou au taux horaire). Tu pourras les relire avant envoi.</p>
              <div className="space-y-1.5">
                {regieCandidates.map((c) => (
                  <div key={c.project.id} className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-2 text-xs">
                    <span className="flex-1 truncate">{c.project.client_name} — {c.project.name}</span>
                    <span className="font-mono text-text-muted">{formatDuration(c.minutes)}</span>
                    {c.line
                      ? <span className="font-mono font-bold text-emerald-400">{formatCurrency(c.line.quantity * c.line.unit_price)}</span>
                      : <span className="text-amber-400">taux manquant</span>}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setRegieMonth(null)}>Annuler</Button>
                <Button className="flex-1" loading={regieBusy} disabled={!regieCandidates.some((c) => c.line)} onClick={createRegieInvoices}>
                  Créer {regieCandidates.filter((c) => c.line).length} brouillon{regieCandidates.filter((c) => c.line).length > 1 ? "s" : ""}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal création */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle facture" size="lg">
        <div className="space-y-4">
          <Select
            label="Mission"
            options={projects.filter((p) => p.status === "active").map((p) => ({ value: p.id, label: `${p.client_name} — ${p.name}` }))}
            value={cProject}
            onChange={(e) => selectProject(e.target.value)}
            placeholder="Sans mission"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Émetteur (nom)" value={cIssuerName} onChange={(e) => setCIssuerName(e.target.value)} placeholder="Ton nom / société" />
            <Input label="Client (détails)" value={cClientDetails} onChange={(e) => setCClientDetails(e.target.value)} placeholder="Adresse, SIRET client..." />
          </div>
          <Input label="Émetteur (détails : adresse, SIRET, contact...)" value={cIssuerDetails} onChange={(e) => setCIssuerDetails(e.target.value)} placeholder="12 rue..., SIRET..., contact@..." />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Émission" type="date" value={cIssue} onChange={(e) => setCIssue(e.target.value)} />
            <Input label="Échéance" type="date" value={cDue} onChange={(e) => setCDue(e.target.value)} />
            <Input label="TVA %" type="number" step="0.1" value={cVat} onChange={(e) => setCVat(e.target.value)} />
          </div>

          {cProject && selectedProject && (
            <div className="space-y-2 bg-surface-2 rounded-xl p-3">
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={includeTime} onChange={(e) => setIncludeTime(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                Temps non facturé : <b className="font-mono">{formatDuration(unbilledMinutes(cProject))}</b>
                {(() => {
                  const line = timeBillingLine(selectedProject, unbilledMinutes(cProject), hoursPerDay);
                  if (line) return <span className="text-emerald-400 font-mono">→ {formatCurrency(line.quantity * line.unit_price)}</span>;
                  return unbilledMinutes(cProject) > 0 ? <span className="text-amber-400">(TJM ou taux horaire non défini)</span> : null;
                })()}
              </label>
              {billableMilestones.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={milestoneIds.includes(m.id)}
                    onChange={(e) => setMilestoneIds((ids) => e.target.checked ? [...ids, m.id] : ids.filter((x) => x !== m.id))}
                    className="w-4 h-4 accent-emerald-500"
                  />
                  {m.title} : <b className="font-mono">{formatCurrency(Number(m.amount))}</b>
                  {m.due_date && <span className="text-text-muted">· prévu le {formatDate(m.due_date, "d MMM")}</span>}
                </label>
              ))}
              {selectedProject.total_amount != null && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={includeFixed} onChange={(e) => setIncludeFixed(e.target.checked)} className="w-4 h-4 accent-emerald-500" />
                  Forfait mission : <b className="font-mono">{formatCurrency(Number(selectedProject.total_amount))}</b>
                </label>
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Lignes libres</p>
            {freeLines.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input value={l.label} onChange={(e) => setFreeLines((f) => f.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Libellé" className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500" />
                <input value={l.qty} onChange={(e) => setFreeLines((f) => f.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))} placeholder="Qté" className="w-16 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none focus:border-brand-500" />
                <input value={l.price} onChange={(e) => setFreeLines((f) => f.map((x, j) => j === i ? { ...x, price: e.target.value } : x))} placeholder="P.U." className="w-24 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none focus:border-brand-500" />
                <button onClick={() => setFreeLines((f) => f.filter((_, j) => j !== i))} className="p-2 text-text-muted hover:text-rose-400"><XCircle className="w-4 h-4" /></button>
              </div>
            ))}
            <button onClick={() => setFreeLines((f) => [...f, { label: "", qty: "1", price: "" }])} className="text-xs text-brand-400 hover:underline">+ Ajouter une ligne</button>
          </div>

          <Input label="Notes / conditions de paiement" value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="Paiement sous 30 jours..." />

          <div className="bg-surface-2 rounded-xl p-3 text-xs space-y-1 font-mono">
            <div className="flex justify-between"><span>Total HT</span><span>{formatCurrency(previewTotals.ht)}</span></div>
            <div className="flex justify-between text-text-muted"><span>TVA ({parseFloat(cVat) || 0} %)</span><span>{formatCurrency(previewTotals.tva)}</span></div>
            <div className="flex justify-between font-bold text-sm"><span>Total TTC</span><span>{formatCurrency(previewTotals.ttc)}</span></div>
          </div>

          {/* Conditions de paiement / échéances */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Conditions de paiement</label>
            <Input label="Conditions générales" value={cPaymentTerms} onChange={(e) => setCPaymentTerms(e.target.value)} placeholder="Ex: 50% démarrage / 30% MVP / 20% mise en ligne" />
            <p className="text-[10px] text-text-muted mt-1">Échéances en % du TTC — sans échéance, la facture se règle en une fois.</p>
            <div className="space-y-1.5">
              {cPayments.map((p, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input value={p.label} onChange={(e) => setCPayments((f) => f.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} placeholder="Libellé (ex: Acompte)" className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500" />
                  <div className="relative w-20">
                    <input value={p.percent} onChange={(e) => setCPayments((f) => f.map((x, j) => j === i ? { ...x, percent: e.target.value } : x))} placeholder="%" type="number" step="0.01" className="w-full bg-surface-2 border border-surface-4 rounded-xl pl-2 pr-6 py-2 text-xs outline-none focus:border-brand-500" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">%</span>
                  </div>
                  <span className="w-20 text-right text-[11px] font-mono text-text-secondary">{formatCurrency(previewPayments[i]?.amount_due || 0)}</span>
                  <input type="date" value={p.due_date} onChange={(e) => setCPayments((f) => f.map((x, j) => j === i ? { ...x, due_date: e.target.value } : x))} className="w-32 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none focus:border-brand-500" />
                  <button onClick={() => setCPayments((f) => f.filter((_, j) => j !== i))} className="p-2 text-text-muted hover:text-rose-400" aria-label="Retirer l'échéance"><XCircle className="w-4 h-4" /></button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <button onClick={() => setCPayments((f) => [...f, { label: "", percent: f.length === 0 ? "100" : "", due_date: "" }])} className="text-xs text-brand-400 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter une échéance</button>
                {cPayments.length === 0 && (
                  <button onClick={() => setCPayments([{ label: "Acompte", percent: "30", due_date: cIssue }, { label: "Solde", percent: "70", due_date: cDue }])} className="text-xs text-text-muted hover:text-brand-400 hover:underline">Acompte 30 % + solde</button>
                )}
                {cPayments.length > 0 && !termsComplete && (
                  <span className="text-[10px] text-amber-400">Total : {paymentTerms.reduce((s, t) => s + t.percent, 0)} % (doit faire 100 %)</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={handleCreate}>Créer la facture</Button>
          </div>
        </div>
      </Modal>

      {/* Modal détail + impression */}
      <Modal isOpen={!!detail} onClose={() => { setDetail(null); setPayAccount(""); }} title={detail ? `Facture ${detail.number}` : ""} size="lg">
        {liveDetail && detailTotals && (
          <div className="space-y-4">
            <div className="invoice-sheet bg-white text-slate-900 rounded-2xl p-6 md:p-8 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-black tracking-tight">FACTURE</p>
                  <p className="font-mono font-bold text-lg">{liveDetail.number}</p>
                </div>
                <div className="text-right text-xs">
                  <p><b>Émission :</b> {formatDate(liveDetail.issue_date, "d MMM yyyy")}</p>
                  {liveDetail.due_date && <p><b>Échéance :</b> {formatDate(liveDetail.due_date, "d MMM yyyy")}</p>}
                  <p><b>Statut :</b> {STATUS_LABEL[liveDetail.status]}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-bold uppercase tracking-wider text-slate-500 mb-1">Émetteur</p>
                  <p className="font-bold">{liveDetail.issuer_name || "—"}</p>
                  {liveDetail.issuer_details && <p className="whitespace-pre-line text-slate-600">{liveDetail.issuer_details}</p>}
                </div>
                <div>
                  <p className="font-bold uppercase tracking-wider text-slate-500 mb-1">Facturé à</p>
                  <p className="font-bold">{liveDetail.project ? liveDetail.project.client_name : "—"}</p>
                  {liveDetail.project && <p className="text-slate-600">{liveDetail.project.name}</p>}
                  {liveDetail.client_details && <p className="whitespace-pre-line text-slate-600">{liveDetail.client_details}</p>}
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-left">
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 px-2 text-right">Qté</th>
                    <th className="py-2 px-2 text-right">P.U.</th>
                    <th className="py-2 pl-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {(liveDetail.items || []).map((it) => (
                    <tr key={it.id} className="border-b border-slate-200">
                      <td className="py-2 pr-2">{it.label}</td>
                      <td className="py-2 px-2 text-right font-mono">{Number(it.quantity)}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(Number(it.unit_price))}</td>
                      <td className="py-2 pl-2 text-right font-mono font-bold">{formatCurrency(Number(it.quantity) * Number(it.unit_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Échéances / paiements partiels */}
              {((liveDetail.payments || []).length > 0 || liveDetail.status === "draft" || liveDetail.status === "sent") && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-brand-400" /> Échéances de paiement
                  </p>
                  {(liveDetail.payments || []).length > 0 && (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-left">
                        <th className="py-2 pr-2">Libellé</th>
                        <th className="py-2 px-2 text-right">Montant dû</th>
                        <th className="py-2 px-2 text-right">Échéance</th>
                        <th className="py-2 pl-2 text-right">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(liveDetail.payments || []).map((p) => {
                        const isPaid = p.status === "paid";
                        const overdue = isPaymentOverdue(p, today);
                        return (
                          <tr key={p.id} className={`border-b border-slate-200 ${isPaid ? "text-slate-400" : ""}`}>
                            <td className="py-2 pr-2 truncate max-w-[200px]">{p.label}</td>
                            <td className="py-2 px-2 text-right font-mono">{formatCurrency(p.amount_due)}</td>
                            <td className="py-2 px-2 text-right font-mono">{p.due_date ? formatDate(p.due_date, "d MMM yyyy") : "—"}</td>
                            <td className="py-2 pl-2 text-right">
                              {isPaid ? (
                                <span className="text-[10px] font-bold text-emerald-600 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" /> Payé{p.paid_date ? ` le ${formatDate(p.paid_date, "d MMM")}` : ""}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 print-hide">
                                  {overdue && <span className="text-[10px] font-bold text-rose-500 mr-1">En retard</span>}
                                  {liveDetail.status === "sent" && (
                                    <Button size="sm" variant="ghost" onClick={() => handleMarkPaymentPaid(p)} disabled={payingPaymentId === p.id} aria-label="Marquer l'échéance payée">
                                      {payingPaymentId === p.id ? <Clock className="w-3 h-3 animate-spin" /> : <Banknote className="w-3 h-3" />}
                                    </Button>
                                  )}
                                  <button onClick={() => removePayment(p.id, liveDetail.id)} className="p-1 text-slate-400 hover:text-rose-500" aria-label="Supprimer l'échéance"><Trash2 className="w-3 h-3" /></button>
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  )}
                  {(liveDetail.payments || []).length > 0 && (() => {
                    const sum = summarizePayments(liveDetail.payments || [], today);
                    const mismatch = Math.abs(sum.due - detailTotals.ttc) >= 0.01;
                    return (
                      <div className="mt-2 pt-2 border-t border-slate-200 flex justify-end">
                        <div className="w-56 text-xs font-mono space-y-1">
                          <div className="flex justify-between"><span>Total échéances</span><span>{formatCurrency(sum.due)}</span></div>
                          <div className="flex justify-between"><span>Déjà payé</span><span>{formatCurrency(sum.paid)}</span></div>
                          <div className="flex justify-between font-bold text-sm"><span>Reste à payer</span><span>{formatCurrency(sum.remaining)}</span></div>
                          {mismatch && <p className="text-[10px] text-amber-600 font-sans print-hide">≠ TTC ({formatCurrency(detailTotals.ttc)})</p>}
                        </div>
                      </div>
                    );
                  })()}
                  {(liveDetail.status === "draft" || liveDetail.status === "sent") && (
                    <div className="flex gap-2 mt-2 print-hide">
                      <input value={npLabel} onChange={(e) => setNpLabel(e.target.value)} placeholder="Nouvelle échéance..." className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-500" />
                      <input value={npAmount} onChange={(e) => setNpAmount(e.target.value)} placeholder="Montant" type="number" step="0.01" className="w-24 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-500" />
                      <input value={npDue} onChange={(e) => setNpDue(e.target.value)} type="date" className="w-32 bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand-500" />
                      <button onClick={handleAddPayment} className="text-xs text-brand-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter</button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex justify-end">
                <div className="w-56 text-xs space-y-1 font-mono">
                  <div className="flex justify-between"><span>Total HT</span><span>{formatCurrency(detailTotals.ht)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>TVA ({Number(liveDetail.vat_rate)} %)</span><span>{formatCurrency(detailTotals.tva)}</span></div>
                  <div className="flex justify-between font-black text-base border-t-2 border-slate-900 pt-1"><span>Total TTC</span><span>{formatCurrency(detailTotals.ttc)}</span></div>
                </div>
              </div>
              {liveDetail.notes && <p className="text-[11px] text-slate-600 whitespace-pre-line border-t border-slate-200 pt-3">{liveDetail.notes}</p>}
            </div>

            {liveDetail.status === "draft" && (
              <div className="flex gap-2">
                <input value={nLabel} onChange={(e) => setNLabel(e.target.value)} placeholder="Nouvelle ligne..." className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500" />
                <input value={nQty} onChange={(e) => setNQty(e.target.value)} placeholder="Qté" className="w-16 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none" />
                <input value={nPrice} onChange={(e) => setNPrice(e.target.value)} placeholder="P.U." className="w-24 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none" />
                <Button size="sm" onClick={() => {
                  if (!nLabel.trim() || !(parseFloat(nPrice) > 0)) { toast.error("Libellé + prix requis"); return; }
                  addItem(liveDetail.id, { label: nLabel.trim(), quantity: parseFloat(nQty) || 1, unit_price: parseFloat(nPrice), kind: "other" });
                  setNLabel(""); setNQty("1"); setNPrice("");
                }}>Ajouter</Button>
              </div>
            )}
            {liveDetail.status === "draft" && (liveDetail.items || []).length > 0 && (
              <div className="space-y-1">
                {(liveDetail.items || []).map((it) => (
                  <div key={it.id} className="flex items-center gap-2 text-xs bg-surface-2 rounded-lg px-3 py-1.5">
                    <span className="flex-1 truncate">{it.label}</span>
                    <button onClick={() => removeItem(it.id, liveDetail.id)} className="p-1 text-text-muted hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 print-hide">
              <Button variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={handlePrint}>Imprimer / PDF</Button>
              {liveDetail.status === "draft" && (
                <Button variant="secondary" icon={<Send className="w-4 h-4" />} onClick={() => { updateStatus(liveDetail.id, "sent"); setDetail({ ...liveDetail, status: "sent" }); toast.success("Facture marquée envoyée"); }}>
                  Marquer envoyée
                </Button>
              )}
              {liveDetail.status === "sent" && (() => {
                // Relance : première échéance en retard, sinon la facture entière si son échéance est passée
                const late = (liveDetail.payments || []).find((p) => isPaymentOverdue(p, today));
                const invoiceLate = (liveDetail.payments || []).length === 0 && !!liveDetail.due_date && liveDetail.due_date < today;
                if (!late && !invoiceLate) return null;
                const remind = () => openExternal(buildDunningMailto({
                  number: liveDetail.number,
                  label: late ? late.label : "facture",
                  amount: late ? Number(late.amount_due) - Number(late.amount_paid) : detailTotals?.ttc ?? 0,
                  dueDate: late ? late.due_date : liveDetail.due_date,
                  clientName: liveDetail.project?.client_name,
                  clientDetails: liveDetail.client_details,
                  issuerName: liveDetail.issuer_name,
                })).catch(() => toast.error("Impossible d'ouvrir la messagerie"));
                return (
                  <Button variant="danger" icon={<Mail className="w-4 h-4" />} onClick={remind}>
                    Relancer le client
                  </Button>
                );
              })()}
              {liveDetail.status === "sent" && (
                <div className="flex gap-2 flex-1">
                  <Select
                    options={accounts.map((a) => ({ value: a.id, label: a.name }))}
                    value={payAccount}
                    onChange={(e) => setPayAccount(e.target.value)}
                    placeholder="Compte d'encaissement..."
                  />
                  {(liveDetail.payments || []).length === 0 && (
                    <Button icon={<Banknote className="w-4 h-4" />} onClick={handleMarkPaid}>Marquer payée</Button>
                  )}
                </div>
              )}
              {(liveDetail.status === "draft" || liveDetail.status === "sent") && (
                <Button variant="ghost" className="text-text-muted" icon={<XCircle className="w-4 h-4" />} onClick={() => { updateStatus(liveDetail.id, "cancelled"); setDetail({ ...liveDetail, status: "cancelled" }); }}>
                  Annuler
                </Button>
              )}
              {liveDetail.status === "draft" && (
                <Button variant="ghost" className="text-rose-400 ml-auto" icon={<Trash2 className="w-4 h-4" />} onClick={() => { remove(liveDetail.id); setDetail(null); }}>
                  Supprimer
                </Button>
              )}
            </div>
            {liveDetail.status === "paid" && (
              <p className="text-xs text-emerald-400 flex items-center gap-1.5"><Check className="w-4 h-4" /> Payée {liveDetail.paid_at ? `le ${formatDate(liveDetail.paid_at, "d MMM yyyy")}` : ""} — recette enregistrée et liée à la mission.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
