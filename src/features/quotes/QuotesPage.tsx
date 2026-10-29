import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuotesStore } from "@/stores/useQuotesStore";
import { useClientsStore, clientDetailsText } from "@/stores/useClientsStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { isQuoteExpired, quoteTotals } from "@/lib/utils/missionMetrics";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  Plus, FileSignature, Trash2, Printer, Send, Check, XCircle, Copy, AlertTriangle, Briefcase, ReceiptText, Percent,
} from "lucide-react";
import { toast } from "sonner";
import type { Quote, QuoteStatus } from "@/types";

const ISSUER_KEY = "mapoche-invoice-issuer";

const STATUS_LABEL: Record<QuoteStatus, string> = {
  draft: "Brouillon",
  sent: "Envoyé",
  accepted: "Accepté",
  declined: "Refusé",
};

const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: "bg-surface-3 text-text-secondary border-surface-4",
  sent: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  accepted: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  declined: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

const UNITS = [
  { value: "jour", label: "jour" },
  { value: "heure", label: "heure" },
  { value: "forfait", label: "forfait" },
  { value: "unité", label: "unité" },
];

type Line = { label: string; qty: string; unit: string; price: string };

function loadIssuer(): { name: string; details: string } {
  try {
    return JSON.parse(localStorage.getItem(ISSUER_KEY) || '{"name":"","details":""}');
  } catch {
    return { name: "", details: "" };
  }
}

const plusDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export default function QuotesPage() {
  const {
    quotes, loading, schemaError, fetch, create, setStatus, remove, addItem, removeItem, duplicate, accept,
  } = useQuotesStore();
  const { clients, fetch: fetchClients, ensure } = useClientsStore();
  const { fetch: fetchProjects } = useProjectsStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const today = new Date().toISOString().slice(0, 10);

  const [statusFilter, setStatusFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);

  // Formulaire
  const [cClient, setCClient] = useState("");
  const [cNewClient, setCNewClient] = useState("");
  const [cTitle, setCTitle] = useState("");
  const [cIssue, setCIssue] = useState(today);
  const [cValid, setCValid] = useState(plusDays(today, 30));
  const [cVat, setCVat] = useState("0");
  const [cDeposit, setCDeposit] = useState("30");
  const [cNotes, setCNotes] = useState("");
  const [lines, setLines] = useState<Line[]>([{ label: "", qty: "1", unit: "jour", price: "" }]);
  // Ajout de ligne (détail, brouillon)
  const [nLabel, setNLabel] = useState("");
  const [nQty, setNQty] = useState("1");
  const [nUnit, setNUnit] = useState("jour");
  const [nPrice, setNPrice] = useState("");

  useEffect(() => { fetch(); fetchClients(); fetchProjects(); }, [fetch, fetchClients, fetchProjects]);

  const clientRate = (clientId: string) => {
    const c = clients.find((x) => x.id === clientId);
    return c?.default_daily_rate != null ? String(c.default_daily_rate) : "";
  };

  const openCreate = (clientId = "") => {
    setCClient(clientId); setCNewClient(""); setCTitle("");
    setCIssue(today); setCValid(plusDays(today, 30)); setCVat("0"); setCDeposit("30"); setCNotes("");
    setLines([{ label: "", qty: "1", unit: "jour", price: clientId ? clientRate(clientId) : "" }]);
    setCreateOpen(true);
  };

  // Liens entrants : ?client=ID (nouveau devis) ou ?quote=ID (ouvrir)
  useEffect(() => {
    const cid = searchParams.get("client");
    const qid = searchParams.get("quote");
    if (cid && clients.some((c) => c.id === cid)) {
      openCreate(cid);
      setSearchParams({}, { replace: true });
    } else if (qid && quotes.some((q) => q.id === qid)) {
      setDetailId(qid);
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, clients, quotes]);

  const filtered = useMemo(
    () => quotes.filter((q) => !statusFilter || q.status === statusFilter),
    [quotes, statusFilter],
  );

  const stats = useMemo(() => {
    const pending = quotes.filter((q) => q.status === "sent");
    const decided = quotes.filter((q) => q.status === "accepted" || q.status === "declined");
    const accepted = quotes.filter((q) => q.status === "accepted");
    const yearAccepted = accepted.filter((q) => (q.accepted_at || "").startsWith(today.slice(0, 4)));
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((s, q) => s + quoteTotals(q.items || [], q.vat_rate).ht, 0),
      conversion: decided.length ? Math.round((accepted.length / decided.length) * 100) : null,
      signedYear: yearAccepted.reduce((s, q) => s + quoteTotals(q.items || [], q.vat_rate).ht, 0),
    };
  }, [quotes, today]);

  const parsedLines = lines
    .filter((l) => l.label.trim() && parseFloat(l.price) > 0)
    .map((l) => ({
      label: l.label.trim(),
      quantity: parseFloat(l.qty.replace(",", ".")) || 1,
      unit: l.unit || null,
      unit_price: parseFloat(l.price.replace(",", ".")),
    }));
  const preview = quoteTotals(parsedLines, parseFloat(cVat) || 0);

  const handleCreate = async () => {
    if (!cTitle.trim()) { toast.error("Donne un titre au devis"); return; }
    if (parsedLines.length === 0) { toast.error("Ajoute au moins une ligne chiffrée"); return; }
    setSaving(true);
    let clientId = cClient || null;
    if (!clientId && cNewClient.trim()) clientId = (await ensure(cNewClient))?.id || null;
    const q = await create({
      client_id: clientId,
      title: cTitle.trim(),
      issue_date: cIssue,
      valid_until: cValid || null,
      vat_rate: parseFloat(cVat) || 0,
      deposit_percent: parseFloat(cDeposit) > 0 ? parseFloat(cDeposit) : null,
      notes: cNotes.trim() || null,
      items: parsedLines,
    });
    setSaving(false);
    if (q) {
      setCreateOpen(false);
      setDetailId(q.id);
    }
  };

  const detail = detailId ? quotes.find((q) => q.id === detailId) || null : null;
  const detailTotals = detail ? quoteTotals(detail.items || [], detail.vat_rate) : null;
  const detailClient = detail?.client_id ? clients.find((c) => c.id === detail.client_id) || detail.client || null : null;
  const issuer = loadIssuer();

  const handleAccept = async (q: Quote) => {
    setAccepting(true);
    const project = await accept(q, detailClient?.name || "Client");
    setAccepting(false);
    if (project) {
      setDetailId(null);
      navigate(`/missions?project=${project.id}`);
    }
  };

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Devis"
        subtitle="Propositions commerciales, acceptées en un clic en mission"
        actions={
          <>
            <Select
              options={[
                { value: "", label: "Tous les statuts" },
                ...Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label })),
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => openCreate()}>Nouveau devis</Button>
          </>
        }
      />

      {schemaError && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-2xl px-4 py-3 text-xs text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-px" />
          <span>Tables devis absentes : exécutez la migration <code className="font-mono">add_clients_quotes.sql</code> dans Supabase.</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Send className="w-3.5 h-3.5 text-sky-400" />En attente</p>
          <p className="text-xl font-bold font-mono">{formatCurrency(stats.pendingAmount)}</p>
          <p className="text-[11px] text-text-muted">{stats.pendingCount} devis envoyé{stats.pendingCount > 1 ? "s" : ""}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Percent className="w-3.5 h-3.5 text-brand-400" />Transformation</p>
          <p className="text-xl font-bold font-mono">{stats.conversion != null ? `${stats.conversion} %` : "—"}</p>
          <p className="text-[11px] text-text-muted">acceptés / décidés</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-4">
          <p className="text-[11px] text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" />Signé {today.slice(0, 4)}</p>
          <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(stats.signedYear)}</p>
          <p className="text-[11px] text-text-muted">HT</p>
        </div>
      </div>

      {loading && quotes.length === 0 ? (
        <SkeletonList rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="w-12 h-12" />}
          title="Aucun devis"
          description="Chiffre une proposition au jour, à l'heure ou au forfait. Une fois acceptée, elle devient une mission avec son acompte."
          actionLabel="Créer un devis"
          onAction={() => openCreate()}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((q) => {
            const t = quoteTotals(q.items || [], q.vat_rate);
            const expired = isQuoteExpired(q, today);
            const client = clients.find((c) => c.id === q.client_id) || q.client;
            return (
              <button
                key={q.id}
                onClick={() => setDetailId(q.id)}
                className="w-full flex items-center gap-3 bg-surface-1 border border-surface-3 hover:border-brand-500/30 rounded-2xl px-4 py-3 text-left transition-colors"
              >
                <FileSignature className="w-4 h-4 text-text-muted shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{q.title}</p>
                  <p className="text-[11px] text-text-muted truncate">
                    <span className="font-mono">{q.number}</span> · {client?.name || "Sans client"} · {formatDate(q.issue_date, "d MMM yyyy")}
                  </p>
                </div>
                <span className="font-mono text-sm font-bold shrink-0">{formatCurrency(t.ht)}</span>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${expired ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : STATUS_STYLE[q.status]}`}>
                  {expired ? "Expiré" : STATUS_LABEL[q.status]}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Création */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nouveau devis" size="lg">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Select
              label="Client"
              options={clients.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Nouveau client…"
              value={cClient}
              onChange={(e) => {
                setCClient(e.target.value);
                const rate = clientRate(e.target.value);
                if (rate) setLines((ls) => ls.map((l) => (l.unit === "jour" && !l.price ? { ...l, price: rate } : l)));
              }}
            />
            {!cClient && (
              <Input label="Nom du nouveau client" value={cNewClient} onChange={(e) => setCNewClient(e.target.value)} placeholder="Créé à l'enregistrement" />
            )}
          </div>
          <Input label="Objet" value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder="Ex : Audit SI et feuille de route" />

          <div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Lignes</p>
            <div className="space-y-2">
              {lines.map((l, i) => (
                <div key={i} className="flex flex-wrap sm:flex-nowrap gap-2">
                  <input
                    value={l.label}
                    onChange={(e) => updateLine(i, { label: e.target.value })}
                    placeholder="Prestation"
                    className="flex-1 min-w-[160px] bg-surface-2 border border-surface-4 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500"
                  />
                  <input
                    value={l.qty}
                    onChange={(e) => updateLine(i, { qty: e.target.value })}
                    placeholder="Qté"
                    className="w-16 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs font-mono outline-none focus:border-brand-500"
                  />
                  <select
                    value={l.unit}
                    onChange={(e) => updateLine(i, { unit: e.target.value })}
                    className="w-24 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none focus:border-brand-500"
                  >
                    {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <input
                    value={l.price}
                    onChange={(e) => updateLine(i, { price: e.target.value })}
                    placeholder="P.U. HT"
                    className="w-24 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs font-mono outline-none focus:border-brand-500"
                  />
                  <button
                    onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                    disabled={lines.length === 1}
                    className="p-2 text-text-muted hover:text-rose-400 disabled:opacity-20"
                    aria-label="Supprimer la ligne"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => setLines((ls) => [...ls, { label: "", qty: "1", unit: "jour", price: cClient ? clientRate(cClient) : "" }])}
              className="mt-2 flex items-center gap-1 text-xs text-brand-400 hover:underline"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter une ligne
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input label="Émis le" type="date" value={cIssue} onChange={(e) => setCIssue(e.target.value)} />
            <Input label="Valable jusqu'au" type="date" value={cValid} onChange={(e) => setCValid(e.target.value)} />
            <Input label="TVA %" type="number" value={cVat} onChange={(e) => setCVat(e.target.value)} />
            <Input label="Acompte %" type="number" value={cDeposit} onChange={(e) => setCDeposit(e.target.value)} />
          </div>
          <Input label="Conditions / notes" value={cNotes} onChange={(e) => setCNotes(e.target.value)} placeholder="Périmètre, hypothèses, modalités..." />

          <div className="flex justify-end text-xs font-mono gap-4">
            <span className="text-text-muted">HT {formatCurrency(preview.ht)}</span>
            <span className="font-bold">TTC {formatCurrency(preview.ttc)}</span>
          </div>
          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={handleCreate}>Créer le devis</Button>
          </div>
        </div>
      </Modal>

      {/* Détail + impression */}
      <Modal isOpen={!!detail} onClose={() => setDetailId(null)} title={detail ? `Devis ${detail.number}` : ""} size="lg">
        {detail && detailTotals && (
          <div className="space-y-4">
            <div className="invoice-sheet bg-white text-slate-900 rounded-2xl p-6 md:p-8 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-2xl font-black tracking-tight">DEVIS</p>
                  <p className="font-mono font-bold text-lg">{detail.number}</p>
                </div>
                <div className="text-right text-xs">
                  <p><b>Date :</b> {formatDate(detail.issue_date, "d MMM yyyy")}</p>
                  {detail.valid_until && <p><b>Valable jusqu'au :</b> {formatDate(detail.valid_until, "d MMM yyyy")}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-bold uppercase tracking-wider text-slate-500 mb-1">Émetteur</p>
                  <p className="font-bold">{issuer.name || "—"}</p>
                  {issuer.details && <p className="whitespace-pre-line text-slate-600">{issuer.details}</p>}
                </div>
                <div>
                  <p className="font-bold uppercase tracking-wider text-slate-500 mb-1">Client</p>
                  <p className="font-bold">{detailClient?.name || "—"}</p>
                  {detailClient && <p className="whitespace-pre-line text-slate-600">{clientDetailsText(detailClient)}</p>}
                </div>
              </div>
              <p className="text-sm font-bold">Objet : {detail.title}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-left">
                    <th className="py-2 pr-2">Description</th>
                    <th className="py-2 px-2 text-right">Qté</th>
                    <th className="py-2 px-2 text-right">P.U. HT</th>
                    <th className="py-2 pl-2 text-right">Montant HT</th>
                  </tr>
                </thead>
                <tbody>
                  {(detail.items || []).map((it) => (
                    <tr key={it.id} className="border-b border-slate-200">
                      <td className="py-2 pr-2">
                        {it.label}
                        {detail.status === "draft" && (
                          <button onClick={() => removeItem(it.id, detail.id)} className="ml-2 text-slate-400 hover:text-rose-500 print-hide" aria-label="Supprimer la ligne">
                            <Trash2 className="w-3 h-3 inline" />
                          </button>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{Number(it.quantity)}{it.unit ? ` ${it.unit}${Number(it.quantity) > 1 && it.unit !== "forfait" ? "s" : ""}` : ""}</td>
                      <td className="py-2 px-2 text-right font-mono">{formatCurrency(Number(it.unit_price))}</td>
                      <td className="py-2 pl-2 text-right font-mono font-bold">{formatCurrency(Number(it.quantity) * Number(it.unit_price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-end">
                <div className="w-56 text-xs space-y-1 font-mono">
                  <div className="flex justify-between"><span>Total HT</span><span>{formatCurrency(detailTotals.ht)}</span></div>
                  <div className="flex justify-between text-slate-600"><span>TVA ({Number(detail.vat_rate)} %)</span><span>{formatCurrency(detailTotals.tva)}</span></div>
                  <div className="flex justify-between font-black text-base border-t-2 border-slate-900 pt-1"><span>Total TTC</span><span>{formatCurrency(detailTotals.ttc)}</span></div>
                  {detail.deposit_percent != null && Number(detail.deposit_percent) > 0 && (
                    <div className="flex justify-between text-slate-600 pt-1">
                      <span>Acompte {Number(detail.deposit_percent)} %</span>
                      <span>{formatCurrency(Math.round(detailTotals.ttc * Number(detail.deposit_percent)) / 100)}</span>
                    </div>
                  )}
                </div>
              </div>
              {detail.notes && <p className="text-[11px] text-slate-600 whitespace-pre-line border-t border-slate-200 pt-3">{detail.notes}</p>}
              <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-500 pt-6">
                <p>Bon pour accord, date et signature :</p>
                <p className="border-b border-slate-300 h-10" />
              </div>
            </div>

            {detail.status === "draft" && (
              <div className="flex flex-wrap sm:flex-nowrap gap-2">
                <input value={nLabel} onChange={(e) => setNLabel(e.target.value)} placeholder="Nouvelle ligne..." className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500" />
                <input value={nQty} onChange={(e) => setNQty(e.target.value)} placeholder="Qté" className="w-14 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none" />
                <select value={nUnit} onChange={(e) => setNUnit(e.target.value)} className="w-24 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none">
                  {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
                <input value={nPrice} onChange={(e) => setNPrice(e.target.value)} placeholder="P.U. HT" className="w-24 bg-surface-2 border border-surface-4 rounded-xl px-2 py-2 text-xs outline-none" />
                <Button size="sm" onClick={() => {
                  if (!nLabel.trim() || !(parseFloat(nPrice) > 0)) { toast.error("Libellé + prix requis"); return; }
                  addItem(detail.id, { label: nLabel.trim(), quantity: parseFloat(nQty) || 1, unit: nUnit, unit_price: parseFloat(nPrice) });
                  setNLabel(""); setNQty("1"); setNPrice("");
                }}>Ajouter</Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 print-hide">
              <Button variant="secondary" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Imprimer / PDF</Button>
              {detail.status === "draft" && (
                <Button variant="secondary" icon={<Send className="w-4 h-4" />} onClick={() => { setStatus(detail.id, "sent"); toast.success("Devis marqué envoyé"); }}>
                  Marquer envoyé
                </Button>
              )}
              {(detail.status === "draft" || detail.status === "sent") && (
                <>
                  <Button icon={<Check className="w-4 h-4" />} loading={accepting} onClick={() => handleAccept(detail)}>
                    Accepté → créer la mission
                  </Button>
                  <Button variant="ghost" icon={<XCircle className="w-4 h-4" />} onClick={() => { setStatus(detail.id, "declined"); toast("Devis marqué refusé"); }}>
                    Refusé
                  </Button>
                </>
              )}
              {detail.status === "accepted" && detail.project_id && (
                <>
                  <Button variant="secondary" icon={<Briefcase className="w-4 h-4" />} onClick={() => navigate(`/missions?project=${detail.project_id}`)}>
                    Voir la mission
                  </Button>
                  <Button variant="secondary" icon={<ReceiptText className="w-4 h-4" />} onClick={() => navigate(`/factures?project=${detail.project_id}`)}>
                    Facturer
                  </Button>
                </>
              )}
              {detail.status === "declined" && (
                <Button variant="ghost" onClick={() => setStatus(detail.id, "sent")}>Rouvrir</Button>
              )}
              <div className="flex-1" />
              <Button variant="ghost" icon={<Copy className="w-4 h-4" />} onClick={async () => {
                const copy = await duplicate(detail);
                if (copy) setDetailId(copy.id);
              }}>
                Dupliquer
              </Button>
              <Button variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={() => {
                if (!window.confirm(`Supprimer le devis ${detail.number} ?`)) return;
                remove(detail.id);
                setDetailId(null);
              }}>
                Supprimer
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
