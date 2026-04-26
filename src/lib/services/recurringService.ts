import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth, format } from "date-fns";

/**
 * Parcourt les passifs (liabilities) et génère une transaction de débit
 * pour le mois en cours si elle n'existe pas encore.
 */
export async function syncLiabilityPayments(userId: string) {
  // 1. Récupérer les passifs ayant un paiement mensuel et un compte de débit
  const { data: liabilities } = await supabase
    .from("liabilities")
    .select("*")
    .eq("user_id", userId)
    .gt("monthly_payment", 0)
    .not("account_id", "is", null);

  if (!liabilities || liabilities.length === 0) return;

  const start = format(startOfMonth(new Date()), "yyyy-MM-dd");
  const end = format(endOfMonth(new Date()), "yyyy-MM-dd");

  for (const liability of liabilities) {
    // 2. Vérifier si une transaction existe déjà pour ce passif ce mois-ci
    // On utilise la description ou une note pour marquer la transaction
    const syncMark = `Prélèvement Crédit: ${liability.name}`;
    
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("account_id", liability.account_id)
      .eq("description", syncMark)
      .gte("date", start)
      .lte("date", end);

    if (count === 0) {
      // 3. Créer la transaction de débit
      await supabase.from("transactions").insert({
        user_id: userId,
        account_id: liability.account_id,
        amount: liability.monthly_payment,
        flow: "expense",
        date: format(new Date(), "yyyy-MM-dd"), // Date du jour pour le prélèvement
        description: syncMark,
        note: `Généré automatiquement depuis le passif #${liability.id}`,
        is_reviewed: false,
      });
      
      console.log(`Auto-débit généré pour : ${liability.name}`);
    }
  }
}
