import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useClientsStore, emptyClient, type ClientInput } from "@/stores/useClientsStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useInvoicesStore } from "@/stores/useInvoicesStore";
import { useQuotesStore } from "@/stores/useQuotesStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { clientStats, quoteTotals } from "@/lib/utils/missionMetrics";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonCards } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import {
  Plus, Users, Search, AlertTriangle, Edit2, Trash2, Mail, Phone, Briefcase, FileSignature, Clock, Banknote,
} from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/types";

const STATUS_LABEL: Record<string, string> = {
  prospect: "Prospect", active: "En cours", done: "Terminé", archived: "Archivé",
};

const QUOTE_LABEL: Record<string, string> = {
  draft: "Brouillon", sent: "Envoyé", accepted: "Accepté", declined: "Refusé",
};

const num = (v: string) => (v.trim() === "" ? null : parseFloat(v.replace(",", ".")));

export default function ClientsPage() {
  const { clients, loading, schemaError, fetch, add, update, remove } = useClientsStore();
  const { projects, fetch: fetchProjects } = useProjectsStore();
  const { invoices, fetch: fetchInvoices } = useInvoicesStore();
  const { quotes, fetch: fetchQuotes } = useQuotesStore();
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const navigate = useNavigate();
  const today = new Date().toISOString().slice(0, 10);

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientInput>(emptyClient());
  const [termsInput, setTermsInput] = useState("30");
  const [rateInput, setRateInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  useEffect(() => {
    fetch(); fetchProjects(); fetchInvoices(); fetchQuotes(); fetchTx();
  }, [fetch, fetchProjects, fetchInvoices, fetchQuotes, fetchTx]);

  const stats = useMemo(() => {
    const map = new Map<string, ReturnType<typeof clientStats>>();
    clients.forEach((c) => map.set(c.id, clientStats(c.id, projects, invoices, transactions, today)));
    return map;
  }, [clients, projects, invoices, transactions, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => !q || [c.name, c.contact_name, c.email].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => (stats.get(b.id)?.revenue || 0) - (stats.get(a.id)?.revenue || 0));
  }, [clients, search, stats]);

  const totals = useMemo(() => {
    let revenue = 0, outstanding = 0, late = 0;
    stats.forEach((s) => { revenue += s.revenue; outstanding += s.outstanding; late += s.lateInvoices; });
    return { revenue, outstanding, late };
  }, [stats]);

  const set = <K extends keyof ClientInput>(k: K, v: ClientInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  const openCreate = () => {
    setEditing(null);
    setForm(emptyClient());
    setTermsInput("30"); setRateInput("");
    setFormOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditing(c);
    const { id: _id, user_id: _u, created_at: _c, ...rest } = c;
    setForm(rest);
    setTermsInput(c.payment_terms_days != null ? String(c.payment_terms_days) : "");
    setRateInput(c.default_daily_rate != null ? String(c.default_daily_rate) : "");
    setFormOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Le nom du client est requis"); return; }
    setSaving(true);
    const blank = (v: string | null) => (v && v.trim() ? v.trim() : null);
    const payload: ClientInput = {
      ...form,
      name: form.name.trim(),
      contact_name: blank(form.contact_name),
      email: blank(form.email),
      phone: blank(form.phone),
      address: blank(form.address),
      siret: blank(form.siret),
      vat_number: blank(form.vat_number),
      notes: blank(form.notes),
      payment_terms_days: num(termsInput) != null ? Math.round(num(termsInput) as number) : null,
      default_daily_rate: num(rateInput),
    };
    if (editing) {
      await update(editing.id, payload);
      fetchProjects();
      toast.success("Client mis à jour");
    } else if (await add(payload)) {
      toast.success("Client créé");
    }
    setSaving(false);
    setFormOpen(false);
  };

  const detail = detailId ? clients.find((c) => c.id === detailId) || null : null;
  const detailProjects = detail ? projects.filter((p) => p.client_id === detail.id) : [];
  const detailQuotes = detail ? quotes.filter((q) => q.client_id === detail.id) : [];
  const detailProjectIds = new Set(detailProjects.map((p) => p.id));
  const detailInvoices = detail ? invoices.filter((i) => i.project_id && detailProjectIds.has(i.project_id)) : [];
  const detailStats = detail ? stats.get(detail.id) : null;

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Clients"
        subtitle="Coordonnées, historique et comportement de paiement"
        actions={<Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nouveau client</Button>}
      />

      {schemaError && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-xs text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>Table clients absente : exécutez la migration <code className="font-mono">add_clients_quotes.sql</code> dans Supabase.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-brand-400" />Clients</p>
          <p className="text-xl font-bold font-mono">{clients.length}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5 text-emerald-400" />Encours factures</p>
          <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(totals.outstanding)}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-rose-400" />Factures en retard</p>
          <p className={`text-xl font-bold font-mono ${totals.late > 0 ? "text-rose-400" : ""}`}>{totals.late}</p>
        </div>
      </div>

      {clients.length > 0 && (
        <Input
          icon={<Search className="w-4 h-4" />}
          placeholder="Rechercher un client, un contact, un email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      )}

      {loading && clients.length === 0 ? (
        <SkeletonCards count={4} cardClass="h-32" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="w-12 h-12" />}
          title={search ? "Aucun client trouvé" : "Aucun client"}
          description="Centralise les coordonnées de tes clients : elles rempliront automatiquement tes devis et factures."
          actionLabel={search ? undefined : "Ajouter un client"}
          onAction={search ? undefined : openCreate}
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {filtered.map((c) => {
            const s = stats.get(c.id);
            const slowPayer = s?.avgPaymentDays != null && c.payment_terms_days != null && s.avgPaymentDays > c.payment_terms_days;
            return (
              <button
                key={c.id}
                onClick={() => setDetailId(c.id)}
                className="text-left bg-surface-1 border border-surface-3 hover:border-brand-500/30 rounded-2xl p-5 space-y-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-bold truncate">{c.name}</h3>
                    <p className="text-[11px] text-text-muted truncate">{c.contact_name || c.email || "Pas de contact"}</p>
                  </div>
                  {s && s.activeCount > 0 && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shrink-0">
                      {s.activeCount} en cours
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <p className="text-text-muted">Encaissé</p>
                    <p className="font-mono font-bold text-emerald-400">{formatCurrency(s?.revenue || 0)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Encours</p>
                    <p className={`font-mono font-bold ${s?.lateInvoices ? "text-rose-400" : ""}`}>{formatCurrency(s?.outstanding || 0)}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Paie en</p>
                    <p className={`font-mono font-bold ${slowPayer ? "text-amber-400" : ""}`}>
                      {s?.avgPaymentDays != null ? `${s.avgPaymentDays} j` : "—"}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Formulaire client */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? "Modifier le client" : "Nouveau client"}>
        <div className="space-y-4">
          <Input label="Nom / raison sociale" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex : ACME SAS" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Contact" value={form.contact_name || ""} onChange={(e) => set("contact_name", e.target.value)} placeholder="Prénom Nom" />
            <Input label="Téléphone" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <Input label="Email" type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} placeholder="Pour les relances" />
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted uppercase tracking-wider">Adresse</label>
            <textarea
              value={form.address || ""}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
              className="w-full bg-surface-2 border border-surface-4 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="SIRET" value={form.siret || ""} onChange={(e) => set("siret", e.target.value)} />
            <Input label="N° TVA" value={form.vat_number || ""} onChange={(e) => set("vat_number", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Délai de paiement (j)" type="number" value={termsInput} onChange={(e) => setTermsInput(e.target.value)} />
            <Input label="TJM habituel" type="number" value={rateInput} onChange={(e) => setRateInput(e.target.value)} placeholder="Optionnel" />
          </div>
          <Input label="Notes" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} placeholder="Process de facturation, bon de commande..." />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={save}>{editing ? "Mettre à jour" : "Créer"}</Button>
          </div>
        </div>
      </Modal>

      {/* Fiche client */}
      <Modal isOpen={!!detail} onClose={() => setDetailId(null)} title={detail?.name || ""} size="lg">
        {detail && detailStats && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              {detail.contact_name && <span>{detail.contact_name}</span>}
              {detail.email && (
                <a href={`mailto:${detail.email}`} className="flex items-center gap-1 text-brand-400 hover:underline">
                  <Mail className="w-3.5 h-3.5" />{detail.email}
                </a>
              )}
              {detail.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{detail.phone}</span>}
              <div className="flex-1" />
              <button onClick={() => { setDetailId(null); openEdit(detail); }} className="p-2 text-text-muted hover:text-brand-400" title="Modifier">
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm(`Supprimer ${detail.name} ? Ses missions sont conservées.`)) return;
                  await remove(detail.id);
                  setDetailId(null);
                  toast.success("Client supprimé");
                }}
                className="p-2 text-text-muted hover:text-rose-400" title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {(detail.address || detail.siret || detail.notes) && (
              <div className="text-xs text-text-secondary space-y-1">
                {detail.address && <p className="whitespace-pre-line">{detail.address}</p>}
                {detail.siret && <p>SIRET {detail.siret}{detail.vat_number ? ` · TVA ${detail.vat_number}` : ""}</p>}
                {detail.notes && <p className="italic">{detail.notes}</p>}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-surface-2 rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase">Encaissé</p>
                <p className="text-sm font-mono font-bold text-emerald-400">{formatCurrency(detailStats.revenue)}</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase">Encours</p>
                <p className="text-sm font-mono font-bold">{formatCurrency(detailStats.outstanding)}</p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase">Délai moyen</p>
                <p className="text-sm font-mono font-bold">
                  {detailStats.avgPaymentDays != null ? `${detailStats.avgPaymentDays} j` : "—"}
                  {detail.payment_terms_days != null && <span className="text-text-muted font-normal"> / {detail.payment_terms_days} j</span>}
                </p>
              </div>
              <div className="bg-surface-2 rounded-xl p-3">
                <p className="text-[10px] text-text-muted uppercase">TJM habituel</p>
                <p className="text-sm font-mono font-bold">{detail.default_daily_rate != null ? formatCurrency(Number(detail.default_daily_rate)) : "—"}</p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Missions</h4>
                <button onClick={() => navigate(`/missions?client=${detail.id}`)} className="flex items-center gap-1 text-xs text-brand-400 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Nouvelle mission
                </button>
              </div>
              <div className="space-y-1.5">
                {detailProjects.length === 0 && <p className="text-xs text-text-muted">Aucune mission.</p>}
                {detailProjects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/missions?project=${p.id}`)}
                    className="w-full flex items-center gap-2 bg-surface-2 hover:bg-surface-3 rounded-xl px-3 py-2 text-xs text-left"
                  >
                    <Briefcase className="w-3.5 h-3.5 text-text-muted" />
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-text-muted">{STATUS_LABEL[p.status]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">Devis</h4>
                <button onClick={() => navigate(`/devis?client=${detail.id}`)} className="flex items-center gap-1 text-xs text-brand-400 hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Nouveau devis
                </button>
              </div>
              <div className="space-y-1.5">
                {detailQuotes.length === 0 && <p className="text-xs text-text-muted">Aucun devis.</p>}
                {detailQuotes.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => navigate(`/devis?quote=${q.id}`)}
                    className="w-full flex items-center gap-2 bg-surface-2 hover:bg-surface-3 rounded-xl px-3 py-2 text-xs text-left"
                  >
                    <FileSignature className="w-3.5 h-3.5 text-text-muted" />
                    <span className="font-mono">{q.number}</span>
                    <span className="flex-1 truncate text-text-secondary">{q.title}</span>
                    <span className="font-mono">{formatCurrency(quoteTotals(q.items || [], q.vat_rate).ht)} HT</span>
                    <span className="text-text-muted w-16 text-right">{QUOTE_LABEL[q.status]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2">Factures</h4>
              <div className="space-y-1.5">
                {detailInvoices.length === 0 && <p className="text-xs text-text-muted">Aucune facture.</p>}
                {detailInvoices.map((i) => (
                  <div key={i.id} className="flex items-center gap-2 bg-surface-2 rounded-xl px-3 py-2 text-xs">
                    <span className="font-mono">{i.number}</span>
                    <span className="flex-1 text-text-muted">{formatDate(i.issue_date, "d MMM yyyy")}</span>
                    <span className={i.status === "sent" && i.due_date && i.due_date < today ? "text-rose-400 font-semibold" : "text-text-muted"}>
                      {i.status === "paid" ? "Payée" : i.status === "sent" ? (i.due_date && i.due_date < today ? "En retard" : "Envoyée") : i.status === "draft" ? "Brouillon" : "Annulée"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
