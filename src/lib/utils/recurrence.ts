import { supabase } from "@/lib/supabase";
import { addMonths, addWeeks, addYears, isBefore, isSameDay, parseISO, format } from "date-fns";
import type { Transaction } from "@/types";

export async function processRecurrences(transactions: Transaction[]): Promise<boolean> {
  // Trouver toutes les transactions parentes (qui ont une règle de récurrence et pas de parent)
  const parents = transactions.filter(t => t.recurrence_rule && !t.recurrence_parent_id);
  if (parents.length === 0) return false;

  const newTransactions: any[] = [];
  const today = new Date();

  for (const parent of parents) {
    // Trouver tous les enfants déjà générés pour ce parent
    const children = transactions.filter(t => t.recurrence_parent_id === parent.id);
    const existingDates = new Set([parent.date, ...children.map(c => c.date)]);

    let currentDate = parseISO(parent.date);

    // Calculer la prochaine date en fonction de la règle
    const getNextDate = (date: Date, rule: string) => {
      switch (rule) {
        case 'weekly': return addWeeks(date, 1);
        case 'monthly': return addMonths(date, 1);
        case 'yearly': return addYears(date, 1);
        default: return addMonths(date, 1);
      }
    };

    currentDate = getNextDate(currentDate, parent.recurrence_rule!);

    // Tant que la date calculée est dans le passé ou aujourd'hui, on génère
    while (isBefore(currentDate, today) || isSameDay(currentDate, today)) {
      const dateStr = format(currentDate, "yyyy-MM-dd");
      
      if (!existingDates.has(dateStr)) {
        newTransactions.push({
          user_id: parent.user_id,
          account_id: parent.account_id,
          category_id: parent.category_id,
          amount: parent.amount,
          flow: parent.flow,
          transfer_to_account_id: parent.transfer_to_account_id,
          date: dateStr,
          description: parent.description,
          note: parent.note,
          tags: parent.tags,
          recurrence_rule: parent.recurrence_rule,
          recurrence_parent_id: parent.id,
          is_reviewed: false,
        });
        existingDates.add(dateStr);
      }
      currentDate = getNextDate(currentDate, parent.recurrence_rule!);
    }
  }

  // S'il y a de nouvelles transactions à insérer
  if (newTransactions.length > 0) {
    console.log("Generating recurring transactions...", newTransactions.length);
    await supabase.from("transactions").insert(newTransactions);
    return true;
  }
  return false;
}
