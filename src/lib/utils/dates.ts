import { format, parseISO, startOfMonth, endOfMonth, subMonths, differenceInDays, isToday, isYesterday } from "date-fns";
import { fr } from "date-fns/locale";

export function formatDate(date: string | Date, pattern = "d MMM yyyy"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, pattern, { locale: fr });
}

export function formatRelative(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return "Hier";
  return format(d, "d MMM", { locale: fr });
}

/** Échéance future ou passée en langage naturel : "Demain", "Dans 5 j", "En retard de 3 j". */
export function formatDue(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  if (diff === -1) return "Hier";
  if (diff > 1 && diff < 7) return `Dans ${diff} j`;
  if (diff >= 7 && diff < 30) {
    const w = Math.round(diff / 7);
    return w <= 1 ? "Dans 1 sem." : `Dans ${w} sem.`;
  }
  if (diff >= 30) return format(target, "d MMM", { locale: fr });
  if (diff < -1 && diff > -7) return `En retard de ${-diff} j`;
  return `En retard (${format(target, "d MMM", { locale: fr })})`;
}

export function getMonthRange(date: Date = new Date()) {
  return { start: startOfMonth(date), end: endOfMonth(date) };
}

export function getLast12Months(): Array<{ label: string; start: Date; end: Date }> {
  const months: Array<{ label: string; start: Date; end: Date }> = [];
  for (let i = 11; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    months.push({
      label: format(d, "MMM yy", { locale: fr }),
      start: startOfMonth(d),
      end: endOfMonth(d),
    });
  }
  return months;
}

export function daysUntil(date: string | Date): number {
  const d = typeof date === "string" ? parseISO(date) : date;
  return differenceInDays(d, new Date());
}

export { parseISO, startOfMonth, endOfMonth, subMonths, format };
