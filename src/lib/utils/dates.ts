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
