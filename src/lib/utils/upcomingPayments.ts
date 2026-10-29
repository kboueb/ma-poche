import { addMonths, addWeeks, addYears, parseISO, format, isBefore, startOfDay, differenceInCalendarDays } from "date-fns";
import type { Transaction, Liability, Account, Category, Project, Milestone, MilestoneKind, Invoice } from "@/types";

export interface UpcomingPayment {
  id: string;
  label: string;
  amount: number;
  flow: "income" | "expense" | "none";
  dueDate: string; // yyyy-MM-dd
  daysUntil: number;
  source: "recurrence" | "liability" | "project" | "milestone" | "invoice";
  accountName?: string;
  categoryName?: string;
  projectId?: string;
  milestoneKind?: MilestoneKind;
}

function nextDate(from: Date, rule: string): Date {
  switch (rule) {
    case "weekly": return addWeeks(from, 1);
    case "yearly": return addYears(from, 1);
    default: return addMonths(from, 1);
  }
}

export function computeUpcomingPayments(
  transactions: Transaction[],
  liabilities: Liability[],
  accounts: Account[],
  categories: Category[],
  horizonDays = 60,
  projects: Project[] = [],
  milestones: Milestone[] = [],
  invoices: Invoice[] = [],
): UpcomingPayment[] {
  const today = startOfDay(new Date());
  const out: UpcomingPayment[] = [];
  const accName = (id: string) => accounts.find((a) => a.id === id)?.name;
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;

  // 1. Récurrences parentes actives → prochaines occurrences
  const parents = transactions.filter(
    (t) => t.recurrence_rule && !t.recurrence_parent_id && t.is_active !== false
  );
  for (const p of parents) {
    let d = parseISO(p.date);
    // Avance jusqu'à aujourd'hui ou après
    let guard = 0;
    while ((isBefore(d, today) || differenceInCalendarDays(d, today) === 0) && guard < 500) {
      d = nextDate(d, p.recurrence_rule!);
      guard++;
    }
    // Projette sur l'horizon
    guard = 0;
    while (differenceInCalendarDays(d, today) <= horizonDays && guard < 24) {
      out.push({
        id: `rec-${p.id}-${format(d, "yyyy-MM-dd")}`,
        label: p.description || catName(p.category_id) || "Paiement récurrent",
        amount: Number(p.amount),
        flow: p.flow === "income" ? "income" : "expense",
        dueDate: format(d, "yyyy-MM-dd"),
        daysUntil: differenceInCalendarDays(d, today),
        source: "recurrence",
        accountName: accName(p.account_id),
        categoryName: catName(p.category_id),
      });
      d = nextDate(d, p.recurrence_rule!);
      guard++;
    }
  }

  // 2. Passifs avec mensualité → prochaine échéance mensuelle (jour = start_date ou 1er)
  for (const l of liabilities) {
    if (!l.monthly_payment || Number(l.monthly_payment) <= 0) continue;
    if (Number(l.remaining_amount) <= 0) continue;
    const day = l.start_date ? parseISO(l.start_date).getDate() : 1;
    const mkDate = (base: Date) => {
      const d = new Date(base.getFullYear(), base.getMonth(), Math.min(day, 28));
      return startOfDay(d);
    };
    let d = mkDate(today);
    if (isBefore(d, today)) d = mkDate(addMonths(today, 1));
    let guard = 0;
    while (differenceInCalendarDays(d, today) <= horizonDays && guard < 12) {
      out.push({
        id: `liab-${l.id}-${format(d, "yyyy-MM-dd")}`,
        label: l.name,
        amount: Number(l.monthly_payment),
        flow: "expense",
        dueDate: format(d, "yyyy-MM-dd"),
        daysUntil: differenceInCalendarDays(d, today),
        source: "liability",
      });
      d = mkDate(addMonths(d, 1));
      guard++;
    }
  }

  // 3. Missions actives : date d'échéance (retards inclus)
  for (const p of projects) {
    if (p.status !== "active" || !p.deadline) continue;
    const dd = parseISO(p.deadline);
    const diff = differenceInCalendarDays(dd, today);
    if (diff > horizonDays) continue;
    out.push({
      id: `proj-${p.id}`,
      label: `${p.client_name} — ${p.name}`,
      amount: 0,
      flow: "none",
      dueDate: format(dd, "yyyy-MM-dd"),
      daysUntil: diff,
      source: "project",
      accountName: "Mission",
      projectId: p.id,
    });
  }

  // 4. Jalons ouverts avec date (retards inclus) — les paiements attendus sont des revenus
  for (const m of milestones) {
    if (m.done || !m.due_date) continue;
    const proj = projects.find((x) => x.id === m.project_id);
    if (proj && proj.status !== "active") continue;
    const dd = parseISO(m.due_date);
    const diff = differenceInCalendarDays(dd, today);
    if (diff > horizonDays) continue;
    const isPayment = m.kind === "payment";
    out.push({
      id: `ms-${m.id}`,
      label: m.title,
      amount: isPayment ? Number(m.amount || 0) : 0,
      flow: isPayment ? "income" : "none",
      dueDate: format(dd, "yyyy-MM-dd"),
      daysUntil: diff,
      source: "milestone",
      accountName: proj ? proj.client_name : "Jalon",
      projectId: m.project_id,
      milestoneKind: m.kind,
    });
  }

  // 5. Factures envoyées : chaque échéance non réglée, sinon l'échéance de la facture (retards inclus)
  for (const inv of invoices) {
    if (inv.status !== "sent") continue;
    const client = inv.project?.client_name;
    const payments = inv.payments || [];
    const dues = payments.length > 0
      ? payments
          .filter((p) => p.status !== "paid" && p.due_date)
          .map((p) => ({ id: `invp-${p.id}`, label: `Facture ${inv.number} — ${p.label}`, amount: Number(p.amount_due) - Number(p.amount_paid), date: p.due_date! }))
      : inv.due_date
        ? [{
            id: `inv-${inv.id}`,
            label: `Facture ${inv.number}`,
            amount: (inv.items || []).reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0) * (1 + Number(inv.vat_rate) / 100),
            date: inv.due_date,
          }]
        : [];
    for (const d of dues) {
      const dd = parseISO(d.date);
      const diff = differenceInCalendarDays(dd, today);
      if (diff > horizonDays) continue;
      out.push({
        id: d.id,
        label: d.label,
        amount: Math.round(d.amount * 100) / 100,
        flow: "income",
        dueDate: format(dd, "yyyy-MM-dd"),
        daysUntil: diff,
        source: "invoice",
        accountName: client || "Facture",
        projectId: inv.project_id || undefined,
      });
    }
  }

  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
