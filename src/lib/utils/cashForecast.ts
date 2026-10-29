import { addDays, format, startOfDay } from "date-fns";
import type { UpcomingPayment } from "./upcomingPayments";

export interface ForecastPoint {
  date: string; // yyyy-MM-dd
  balance: number;
  income: number;
  expense: number;
}

export interface CashForecast {
  points: ForecastPoint[];
  /** Point le plus bas sur l'horizon (aujourd'hui inclus) */
  lowest: ForecastPoint;
  end: number;
  /** Premier jour où le solde passe sous zéro, s'il existe */
  firstNegative: string | null;
  totalIncome: number;
  totalExpense: number;
}

export interface ForecastOptions {
  horizonDays: number;
  /** Ignore les encaissements clients (factures, jalons de paiement) : scénario « le client ne paie pas » */
  withoutClientIncome?: boolean;
  today?: Date;
}

const CLIENT_SOURCES: UpcomingPayment["source"][] = ["invoice", "milestone"];

/**
 * Solde projeté jour par jour à partir du solde actuel et de l'échéancier.
 * Les échéances en retard sont comptées aujourd'hui (elles restent dues).
 */
export function computeCashForecast(
  startBalance: number,
  upcoming: UpcomingPayment[],
  { horizonDays, withoutClientIncome = false, today = new Date() }: ForecastOptions,
): CashForecast {
  const day0 = startOfDay(today);
  const byDay = new Map<number, { income: number; expense: number }>();
  let totalIncome = 0;
  let totalExpense = 0;

  for (const p of upcoming) {
    if (p.flow === "none" || p.amount <= 0) continue;
    if (withoutClientIncome && p.flow === "income" && CLIENT_SOURCES.includes(p.source)) continue;
    const idx = Math.max(0, p.daysUntil);
    if (idx > horizonDays) continue;
    const slot = byDay.get(idx) ?? { income: 0, expense: 0 };
    if (p.flow === "income") { slot.income += p.amount; totalIncome += p.amount; }
    else { slot.expense += p.amount; totalExpense += p.amount; }
    byDay.set(idx, slot);
  }

  const points: ForecastPoint[] = [];
  let balance = startBalance;
  let firstNegative: string | null = null;
  for (let i = 0; i <= horizonDays; i++) {
    const slot = byDay.get(i) ?? { income: 0, expense: 0 };
    balance += slot.income - slot.expense;
    const date = format(addDays(day0, i), "yyyy-MM-dd");
    if (firstNegative === null && balance < 0) firstNegative = date;
    points.push({ date, balance: Math.round(balance * 100) / 100, income: slot.income, expense: slot.expense });
  }

  const lowest = points.reduce((min, p) => (p.balance < min.balance ? p : min), points[0]);
  return { points, lowest, end: points[points.length - 1].balance, firstNegative, totalIncome, totalExpense };
}
