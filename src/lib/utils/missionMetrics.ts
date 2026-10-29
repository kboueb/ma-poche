import type {
  BillingMode, Invoice, MissionTemplate, Milestone, Project, Quote, QuoteItem, TimeEntry, Transaction,
} from "@/types";
import { entryMinutes } from "./time";

/** Heures facturables dans une journée de travail, par défaut. */
export const DEFAULT_HOURS_PER_DAY = 7;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function billingModeOf(p: Pick<Project, "billing_mode" | "total_amount" | "hourly_rate" | "daily_rate">): BillingMode {
  if (p.billing_mode) return p.billing_mode;
  if (p.daily_rate != null) return "daily";
  if (p.total_amount == null && p.hourly_rate != null) return "hourly";
  return "fixed";
}

export function minutesToDays(minutes: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): number {
  return minutes / 60 / hoursPerDay;
}

/** Minutes passées sur une mission (entrées terminées ou saisies manuelles). */
export function projectMinutes(projectId: string, entries: TimeEntry[], billableOnly = false): number {
  return entries
    .filter((e) => e.project_id === projectId && (!billableOnly || e.billable))
    .reduce((s, e) => s + entryMinutes(e.started_at, e.ended_at, e.duration_minutes), 0);
}

/**
 * Budget de la mission en jours : saisi directement, ou déduit du forfait et du TJM.
 * Null si rien ne permet de l'estimer.
 */
export function budgetDays(p: Project, hoursPerDay = DEFAULT_HOURS_PER_DAY): number | null {
  if (p.budget_days != null && Number(p.budget_days) > 0) return Number(p.budget_days);
  if (p.total_amount != null && p.daily_rate) return Number(p.total_amount) / Number(p.daily_rate);
  if (p.total_amount != null && p.hourly_rate) return Number(p.total_amount) / Number(p.hourly_rate) / hoursPerDay;
  return null;
}

/** Montant attendu de la mission (vendu), selon le mode de facturation. */
export function expectedRevenue(p: Project, hoursPerDay = DEFAULT_HOURS_PER_DAY): number | null {
  const mode = billingModeOf(p);
  if (mode === "fixed") return p.total_amount != null ? Number(p.total_amount) : null;
  const days = p.budget_days != null ? Number(p.budget_days) : null;
  if (days == null) return p.total_amount != null ? Number(p.total_amount) : null;
  if (mode === "daily" && p.daily_rate) return round2(days * Number(p.daily_rate));
  if (mode === "hourly" && p.hourly_rate) return round2(days * hoursPerDay * Number(p.hourly_rate));
  return p.total_amount != null ? Number(p.total_amount) : null;
}

/** TJM vendu : saisi, ou déduit du taux horaire ou du forfait / budget. */
export function soldDailyRate(p: Project, hoursPerDay = DEFAULT_HOURS_PER_DAY): number | null {
  if (p.daily_rate) return Number(p.daily_rate);
  if (p.hourly_rate) return Number(p.hourly_rate) * hoursPerDay;
  const days = budgetDays(p, hoursPerDay);
  if (p.total_amount != null && days) return round2(Number(p.total_amount) / days);
  return null;
}

/** TJM réel : ce qui a été gagné rapporté aux jours réellement passés. Null sans temps saisi. */
export function effectiveDailyRate(revenue: number, minutesSpent: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): number | null {
  if (minutesSpent <= 0) return null;
  return round2(revenue / minutesToDays(minutesSpent, hoursPerDay));
}

export type BudgetLevel = "ok" | "warning" | "over";

export interface BudgetStatus {
  budgetDays: number;
  spentDays: number;
  remainingDays: number;
  pct: number; // 0-∞
  level: BudgetLevel;
}

/** Consommation du budget : alerte à 80 %, dépassement au-delà de 100 %. */
export function budgetStatus(p: Project, minutesSpent: number, hoursPerDay = DEFAULT_HOURS_PER_DAY): BudgetStatus | null {
  if (p.recurring_monthly) return null; // régie : pas de budget global
  const budget = budgetDays(p, hoursPerDay);
  if (!budget) return null;
  const spent = minutesToDays(minutesSpent, hoursPerDay);
  const pct = (spent / budget) * 100;
  return {
    budgetDays: round2(budget),
    spentDays: round2(spent),
    remainingDays: round2(Math.max(budget - spent, 0)),
    pct: Math.round(pct),
    level: pct > 100 ? "over" : pct >= 80 ? "warning" : "ok",
  };
}

/** Ligne de facture pour du temps passé, au jour (TJM) ou à l'heure. Null sans taux. */
export function timeBillingLine(
  p: Project,
  minutes: number,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): { label: string; quantity: number; unit_price: number } | null {
  if (minutes <= 0) return null;
  const mode = billingModeOf(p);
  if (mode === "daily" && p.daily_rate) {
    const days = round2(minutesToDays(minutes, hoursPerDay));
    return {
      label: `Prestation — ${String(days).replace(".", ",")} j (${p.client_name} / ${p.name})`,
      quantity: days,
      unit_price: Number(p.daily_rate),
    };
  }
  const rate = p.hourly_rate ? Number(p.hourly_rate) : p.daily_rate ? Number(p.daily_rate) / hoursPerDay : null;
  if (!rate) return null;
  const hours = round2(minutes / 60);
  return {
    label: `Temps de travail — ${String(hours).replace(".", ",")} h (${p.client_name} / ${p.name})`,
    quantity: hours,
    unit_price: round2(rate),
  };
}

// ---------------------------------------------------------------------------
// Bilan de mission (estimé vs réel)
// ---------------------------------------------------------------------------

export interface MissionReview {
  plannedDays: number | null;
  spentDays: number;
  daysDelta: number | null; // > 0 = dépassement
  expected: number | null;
  income: number;
  expense: number;
  margin: number;
  soldRate: number | null;
  effectiveRate: number | null;
  rateDelta: number | null; // < 0 = moins bien payé que prévu
  deadline: string | null;
  finishedOn: string | null;
  lateDays: number | null; // > 0 = livré en retard
}

export function missionReview(
  p: Project,
  data: { income: number; expense: number; minutes: number; milestones: Milestone[]; entries: TimeEntry[] },
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): MissionReview {
  const planned = budgetDays(p, hoursPerDay);
  const spent = round2(minutesToDays(data.minutes, hoursPerDay));
  const soldRate = soldDailyRate(p, hoursPerDay);
  const effective = effectiveDailyRate(data.income, data.minutes, hoursPerDay);
  const dates = [
    ...data.entries.filter((e) => e.project_id === p.id).map((e) => (e.ended_at || e.started_at).slice(0, 10)),
    ...data.milestones.filter((m) => m.project_id === p.id && m.done_at).map((m) => m.done_at as string),
  ].sort();
  const finishedOn = dates.length ? dates[dates.length - 1] : null;
  const lateDays = p.deadline && finishedOn
    ? Math.round((Date.parse(finishedOn) - Date.parse(p.deadline)) / 86400000)
    : null;
  return {
    plannedDays: planned != null ? round2(planned) : null,
    spentDays: spent,
    daysDelta: planned != null ? round2(spent - planned) : null,
    expected: expectedRevenue(p, hoursPerDay),
    income: data.income,
    expense: data.expense,
    margin: data.income - data.expense,
    soldRate,
    effectiveRate: effective,
    rateDelta: soldRate != null && effective != null ? round2(effective - soldRate) : null,
    deadline: p.deadline,
    finishedOn,
    lateDays,
  };
}

// ---------------------------------------------------------------------------
// Charge : jours vendus par mois vs capacité
// ---------------------------------------------------------------------------

/** "2026-10" → nombre de jours du mois. */
function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Les `count` mois à partir de `today` (inclus), au format yyyy-MM. */
export function nextMonths(today: string, count: number): string[] {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 + i, 1));
    return d.toISOString().slice(0, 7);
  });
}

export interface MonthLoad {
  month: string;
  days: number;
  byProject: Array<{ projectId: string; days: number }>;
}

/**
 * Jours restant à produire, répartis au prorata calendaire entre aujourd'hui (ou le début) et l'échéance.
 * Régie mensuelle : `budget_days` = jours par mois, chaque mois entre début et échéance (ou sans fin).
 * Les missions sans échéance ni budget sont ignorées ; une échéance passée tombe sur le mois courant.
 */
export function workloadByMonth(
  projects: Project[],
  entries: TimeEntry[],
  months: string[],
  today: string,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): MonthLoad[] {
  const loads = months.map((month) => ({ month, days: 0, byProject: [] as Array<{ projectId: string; days: number }> }));
  const add = (month: string, projectId: string, days: number) => {
    const l = loads.find((x) => x.month === month);
    if (!l || days <= 0) return;
    l.days = round2(l.days + days);
    l.byProject.push({ projectId, days: round2(days) });
  };

  for (const p of projects) {
    if (p.status !== "active") continue;

    if (p.recurring_monthly) {
      const perMonth = p.budget_days != null ? Number(p.budget_days) : 0;
      if (!perMonth) continue;
      for (const month of months) {
        if (p.start_date && p.start_date.slice(0, 7) > month) continue;
        if (p.deadline && p.deadline.slice(0, 7) < month) continue;
        add(month, p.id, perMonth);
      }
      continue;
    }

    const budget = budgetDays(p, hoursPerDay);
    if (!budget || !p.deadline) continue;
    const remaining = budget - minutesToDays(projectMinutes(p.id, entries), hoursPerDay);
    if (remaining <= 0) continue;

    const start = p.start_date && p.start_date > today ? p.start_date : today;
    if (p.deadline <= start) {
      add(start.slice(0, 7), p.id, remaining);
      continue;
    }
    const startMs = Date.parse(start);
    const endMs = Date.parse(p.deadline) + 86400000; // échéance incluse
    const total = (endMs - startMs) / 86400000;
    for (const month of months) {
      const mStart = Date.parse(`${month}-01`);
      const mEnd = mStart + daysInMonth(month) * 86400000;
      const overlap = (Math.min(endMs, mEnd) - Math.max(startMs, mStart)) / 86400000;
      if (overlap > 0) add(month, p.id, (remaining * overlap) / total);
    }
  }
  return loads;
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export interface ClientStats {
  projectCount: number;
  activeCount: number;
  revenue: number; // encaissé (transactions liées aux missions)
  outstanding: number; // factures envoyées non soldées
  avgPaymentDays: number | null; // délai moyen émission → encaissement
  lateInvoices: number;
}

const invoiceTTC = (inv: Invoice) =>
  (inv.items || []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0) * (1 + Number(inv.vat_rate) / 100);

export function clientStats(
  clientId: string,
  projects: Project[],
  invoices: Invoice[],
  transactions: Transaction[],
  today: string,
): ClientStats {
  const own = projects.filter((p) => p.client_id === clientId);
  const ids = new Set(own.map((p) => p.id));
  const revenue = transactions
    .filter((t) => t.flow === "income" && t.project_id && ids.has(t.project_id))
    .reduce((s, t) => s + Number(t.amount), 0);

  const clientInvoices = invoices.filter((i) => i.project_id && ids.has(i.project_id) && i.status !== "cancelled");
  let outstanding = 0;
  let lateInvoices = 0;
  const delays: number[] = [];
  for (const inv of clientInvoices) {
    const payments = inv.payments || [];
    if (inv.status === "sent") {
      const paid = payments.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
      outstanding += Math.max(invoiceTTC(inv) - paid, 0);
      if (inv.due_date && inv.due_date < today) lateInvoices++;
    }
    const paidDates = payments.filter((p) => p.paid_date).map((p) => p.paid_date as string);
    if (inv.paid_at) paidDates.push(inv.paid_at.slice(0, 10));
    for (const d of paidDates) {
      delays.push(Math.max(Math.round((Date.parse(d) - Date.parse(inv.issue_date)) / 86400000), 0));
    }
  }
  return {
    projectCount: own.length,
    activeCount: own.filter((p) => p.status === "active").length,
    revenue,
    outstanding: round2(outstanding),
    avgPaymentDays: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
    lateInvoices,
  };
}

// ---------------------------------------------------------------------------
// Devis
// ---------------------------------------------------------------------------

export function quoteTotals(items: Array<Pick<QuoteItem, "quantity" | "unit_price">>, vatRate: number) {
  const ht = round2(items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0));
  const tva = round2(ht * (Number(vatRate) / 100));
  return { ht, tva, ttc: round2(ht + tva) };
}

/** Numéro suivant au format PREFIX-AAAA-NNN, à partir du dernier numéro de l'année. */
export function nextDocNumber(prefix: string, year: number, last: string | null | undefined): string {
  const n = last ? parseInt(last.split("-").pop() || "0", 10) + 1 : 1;
  return `${prefix}-${year}-${String(n).padStart(3, "0")}`;
}

export function isQuoteExpired(q: Pick<Quote, "status" | "valid_until">, today: string): boolean {
  return q.status === "sent" && !!q.valid_until && q.valid_until < today;
}

const DAY_UNITS = ["j", "jour", "jours", "jh", "j/h"];
const HOUR_UNITS = ["h", "heure", "heures"];

/**
 * Paramètres de la mission créée à l'acceptation d'un devis :
 * lignes au jour → régie au TJM (budget = jours vendus), à l'heure → horaire, sinon forfait.
 */
export function missionFromQuote(
  q: Pick<Quote, "title" | "vat_rate">,
  items: Array<Pick<QuoteItem, "quantity" | "unit_price" | "unit">>,
): { billing_mode: BillingMode; total_amount: number; daily_rate: number | null; hourly_rate: number | null; budget_days: number | null } {
  const { ht } = quoteTotals(items, q.vat_rate);
  const unitOf = (i: Pick<QuoteItem, "unit">) => (i.unit || "").trim().toLowerCase();
  const dayItems = items.filter((i) => DAY_UNITS.includes(unitOf(i)));
  const hourItems = items.filter((i) => HOUR_UNITS.includes(unitOf(i)));
  const weighted = (arr: typeof items) => {
    const qty = arr.reduce((s, i) => s + Number(i.quantity), 0);
    return qty > 0 ? { qty: round2(qty), rate: round2(arr.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0) / qty) } : null;
  };
  if (dayItems.length > 0 && dayItems.length === items.length) {
    const w = weighted(dayItems)!;
    return { billing_mode: "daily", total_amount: ht, daily_rate: w.rate, hourly_rate: null, budget_days: w.qty };
  }
  if (hourItems.length > 0 && hourItems.length === items.length) {
    const w = weighted(hourItems)!;
    return { billing_mode: "hourly", total_amount: ht, daily_rate: null, hourly_rate: w.rate, budget_days: null };
  }
  const days = weighted(dayItems);
  return { billing_mode: "fixed", total_amount: ht, daily_rate: days?.rate ?? null, hourly_rate: null, budget_days: days?.qty ?? null };
}

// ---------------------------------------------------------------------------
// Modèles de mission
// ---------------------------------------------------------------------------

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Jalons d'un modèle, datés depuis le début de la mission et chiffrés en % du montant. */
export function templateMilestones(
  t: Pick<MissionTemplate, "milestones">,
  startDate: string,
  amount: number | null,
): Array<Pick<Milestone, "title" | "kind" | "due_date" | "amount">> {
  return t.milestones.map((m) => ({
    title: m.title,
    kind: m.kind,
    due_date: m.offset_days != null ? addDays(startDate, m.offset_days) : null,
    amount: m.amount_percent != null && amount != null ? round2((amount * m.amount_percent) / 100) : null,
  }));
}

// ---------------------------------------------------------------------------
// Régie : facturation mensuelle du temps
// ---------------------------------------------------------------------------

export interface MonthlyBillingCandidate {
  project: Project;
  month: string;
  minutes: number;
  entryIds: string[];
  line: { label: string; quantity: number; unit_price: number } | null;
}

/** Missions en régie avec du temps facturable non facturé sur le mois donné (yyyy-MM). */
export function monthlyBillingCandidates(
  projects: Project[],
  entries: TimeEntry[],
  month: string,
  hoursPerDay = DEFAULT_HOURS_PER_DAY,
): MonthlyBillingCandidate[] {
  return projects
    .filter((p) => p.recurring_monthly && p.status === "active")
    .map((p) => {
      const own = entries.filter((e) =>
        e.project_id === p.id && e.billable && !e.invoice_id && e.ended_at && e.started_at.slice(0, 7) === month);
      const minutes = own.reduce((s, e) => s + entryMinutes(e.started_at, e.ended_at, e.duration_minutes), 0);
      return { project: p, month, minutes, entryIds: own.map((e) => e.id), line: timeBillingLine(p, minutes, hoursPerDay) };
    })
    .filter((c) => c.minutes > 0);
}

/** Mois précédent de `today` au format yyyy-MM. */
export function previousMonth(today: string): string {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
