import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useInvoicesStore } from "@/stores/useInvoicesStore";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";
import { computeUpcomingPayments, type UpcomingPayment } from "@/lib/utils/upcomingPayments";
import { requestNotificationPermission, sendNotification } from "@/lib/services/notificationService";
import { Bell, BellOff, CalendarClock, Repeat, Landmark, CheckCircle2, Briefcase, BadgeCheck, Banknote, FileText } from "lucide-react";
import { toast } from "sonner";
import type { Liability } from "@/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

const NOTIF_KEY = "mapoche-schedule-notified";

function notifiedToday(ids: string[]): boolean {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (!raw) return false;
    const { date, ids: saved } = JSON.parse(raw) as { date: string; ids: string[] };
    const today = new Date().toISOString().slice(0, 10);
    return date === today && ids.every((id) => saved.includes(id));
  } catch {
    return false;
  }
}

function markNotified(ids: string[]) {
  try {
    localStorage.setItem(NOTIF_KEY, JSON.stringify({ date: new Date().toISOString().slice(0, 10), ids }));
  } catch {
    // ignore
  }
}

export default function SchedulePage() {
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const { accounts, fetch: fetchAcc } = useAccountsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();
  const { projects, milestones, fetch: fetchProjects } = useProjectsStore();
  const { invoices, fetch: fetchInvoices } = useInvoicesStore();
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTx(); fetchAcc(); fetchCat(); fetchProjects(); fetchInvoices();
    supabase.from("liabilities").select("*").then(({ data }) => setLiabilities((data as Liability[]) || []));
    if ("Notification" in window && Notification.permission === "granted") setNotifEnabled(true);
  }, [fetchTx, fetchAcc, fetchCat, fetchProjects, fetchInvoices]);

  const upcoming = useMemo(
    () => computeUpcomingPayments(transactions, liabilities, accounts, categories, 60, projects, milestones, invoices),
    [transactions, liabilities, accounts, categories, projects, milestones, invoices]
  );

  const dueSoon = useMemo(() => upcoming.filter((p) => p.daysUntil <= 3), [upcoming]);
  const later = useMemo(() => upcoming.filter((p) => p.daysUntil > 3), [upcoming]);

  // Notification auto : paiements dus sous 3 jours, une fois par jour
  useEffect(() => {
    if (dueSoon.length === 0 || !notifEnabled) return;
    const ids = dueSoon.map((p) => p.id);
    if (notifiedToday(ids)) return;
    const total = dueSoon
      .filter((p) => p.flow === "expense")
      .reduce((s, p) => s + p.amount, 0);
    sendNotification(
      "maPoche — Échéances à venir",
      `${dueSoon.length} échéance${dueSoon.length > 1 ? "s" : ""} sous 3 jours (${formatCurrency(total)})`
    ).then(() => markNotified(ids)).catch(() => {});
  }, [dueSoon, notifEnabled]);

  const toggleNotif = async () => {
    if (notifEnabled) {
      setNotifEnabled(false);
      toast.info("Rappels désactivés pour cette session");
      return;
    }
    const granted = await requestNotificationPermission();
    setNotifEnabled(granted);
    toast[granted ? "success" : "error"](granted ? "Rappels activés" : "Permission refusée");
  };

  const totalUpcoming = useMemo(
    () => upcoming.filter((p) => p.flow === "expense").reduce((s, p) => s + p.amount, 0),
    [upcoming]
  );

  const Row = ({ p }: { p: UpcomingPayment }) => {
    const target = p.source === "invoice" ? "/factures" : p.source === "project" || p.source === "milestone" ? "/missions" : null;
    const clickable = target !== null;
    const Icon =
      p.source === "recurrence" ? Repeat :
      p.source === "liability" ? Landmark :
      p.source === "project" ? Briefcase :
      p.source === "invoice" ? FileText :
      p.milestoneKind === "validation" ? BadgeCheck :
      p.milestoneKind === "payment" ? Banknote : CalendarClock;
    const iconColor =
      p.flow === "income" ? "bg-emerald-500/10 text-emerald-400" :
      p.flow === "expense" ? "bg-rose-500/10 text-rose-400" :
      "bg-brand-500/10 text-brand-400";
    return (
    <div
      onClick={target ? () => navigate(target) : undefined}
      className={`flex items-center gap-3 px-4 py-3 ${p.daysUntil <= 3 ? "bg-amber-500/5" : ""} ${clickable ? "cursor-pointer hover:bg-surface-2 transition-colors" : ""}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{p.label}</p>
        <p className="text-[11px] text-text-muted truncate">
          {p.daysUntil < 0 ? `En retard de ${-p.daysUntil} j` : p.daysUntil === 0 ? "Aujourd'hui" : p.daysUntil === 1 ? "Demain" : `Dans ${p.daysUntil} jours`}
          {" · "}{formatDate(p.dueDate, "d MMM")}
          {p.accountName ? ` · ${p.accountName}` : ""}
        </p>
      </div>
      {p.flow === "none" ? (
        <p className="text-[11px] text-text-muted shrink-0">—</p>
      ) : (
        <p className={`text-sm font-mono font-bold shrink-0 ${p.flow === "income" ? "text-emerald-400" : "text-rose-400"}`}>
          {p.flow === "income" ? "+" : "−"}{formatCurrency(p.amount)}
        </p>
      )}
    </div>
    );
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title="Échéancier"
        subtitle={`${upcoming.length} paiement${upcoming.length !== 1 ? "s" : ""} prévu${upcoming.length !== 1 ? "s" : ""} · ${formatCurrency(totalUpcoming)} sur 60 jours`}
        actions={
          <button
            onClick={toggleNotif}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
              notifEnabled
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-surface-1 text-text-secondary border-surface-3 hover:bg-surface-2"
            }`}
          >
            {notifEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            {notifEnabled ? "Rappels activés" : "Activer les rappels"}
          </button>
        }
      />

      {upcoming.length === 0 ? (
        <EmptyState
          icon={<CalendarClock />}
          title="Aucun paiement prévu sur 60 jours"
          description="Transactions récurrentes, mensualités, factures et validations de missions apparaîtront ici."
        />
      ) : (
        <>
          {dueSoon.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" /> Sous 3 jours ({dueSoon.length})
              </p>
              <div className="bg-surface-1 border border-amber-500/20 rounded-2xl divide-y divide-surface-3 overflow-hidden">
                {dueSoon.map((p) => <Row key={p.id} p={p} />)}
              </div>
            </div>
          )}

          {later.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 px-1 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> À venir ({later.length})
              </p>
              <div className="bg-surface-1 border border-surface-3 rounded-2xl divide-y divide-surface-3 overflow-hidden">
                {later.map((p) => <Row key={p.id} p={p} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
