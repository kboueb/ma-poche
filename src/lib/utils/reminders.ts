import type { UpcomingPayment } from "./upcomingPayments";
import { formatCurrency } from "./currency";
import { formatDate } from "./dates";

export interface ReminderNotification {
  title: string;
  body: string;
  /** Identifiants des échéances couvertes : sert à ne notifier qu'une fois par jour */
  ids: string[];
}

/** Échéances qui méritent un rappel : dues sous 3 jours, et factures clients en retard (à part). */
export function buildReminderDigest(upcoming: UpcomingPayment[]): ReminderNotification[] {
  const out: ReminderNotification[] = [];

  const overdueInvoices = upcoming.filter((p) => p.source === "invoice" && p.daysUntil < 0);
  if (overdueInvoices.length > 0) {
    const total = overdueInvoices.reduce((s, p) => s + p.amount, 0);
    const n = overdueInvoices.length;
    out.push({
      title: "maPoche — Factures en retard",
      body: `${n} paiement${n > 1 ? "s" : ""} client${n > 1 ? "s" : ""} en retard (${formatCurrency(total)}) : pensez à relancer.`,
      ids: overdueInvoices.map((p) => p.id),
    });
  }

  const dueSoon = upcoming.filter((p) => p.daysUntil >= 0 && p.daysUntil <= 3);
  if (dueSoon.length > 0) {
    const expenses = dueSoon.filter((p) => p.flow === "expense").reduce((s, p) => s + p.amount, 0);
    const n = dueSoon.length;
    out.push({
      title: "maPoche — Échéances à venir",
      body: `${n} échéance${n > 1 ? "s" : ""} sous 3 jours${expenses > 0 ? ` (${formatCurrency(expenses)} à payer)` : ""}`,
      ids: dueSoon.map((p) => p.id),
    });
  }

  return out;
}

export interface NotifiedLog {
  date: string; // yyyy-MM-dd
  ids: string[];
}

/** Vrai si toutes ces échéances ont déjà été notifiées aujourd'hui. */
export function alreadyNotified(log: NotifiedLog | null, today: string, ids: string[]): boolean {
  return !!log && log.date === today && ids.every((id) => log.ids.includes(id));
}

/** Ajoute des échéances au journal du jour (repart de zéro à chaque nouveau jour). */
export function recordNotified(log: NotifiedLog | null, today: string, ids: string[]): NotifiedLog {
  const base = log && log.date === today ? log.ids : [];
  return { date: today, ids: Array.from(new Set([...base, ...ids])) };
}

export interface DunningInput {
  number: string;
  label: string;
  amount: number;
  dueDate: string | null;
  clientName?: string | null;
  clientDetails?: string | null;
  issuerName?: string | null;
}

/** Lien mailto prérempli pour relancer un client ; l'adresse est reprise des coordonnées client si présente. */
export function buildDunningMailto(i: DunningInput): string {
  const to = i.clientDetails?.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? "";
  const subject = `Relance — facture ${i.number}`;
  const due = i.dueDate ? ` arrivé à échéance le ${formatDate(i.dueDate, "d MMMM yyyy")}` : "";
  const body = [
    `Bonjour${i.clientName ? ` ${i.clientName}` : ""},`,
    "",
    `Sauf erreur de ma part, le règlement de la facture ${i.number} (${i.label}) d'un montant de ${formatCurrency(i.amount)}${due} ne m'est pas encore parvenu.`,
    "",
    "Pourriez-vous me confirmer la date de paiement prévue ? Si le règlement a déjà été effectué, merci de ne pas tenir compte de ce message.",
    "",
    "Bien cordialement,",
    i.issuerName ?? "",
  ].join("\n").trimEnd();
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
