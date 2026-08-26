import { supabase } from "@/lib/supabase";
import { startOfMonth, endOfMonth, format } from "date-fns";

/**
 * Parcourt les passifs (liabilities) et génère une transaction de débit
 * pour le mois en cours si elle n'existe pas encore.
 * Supprime les doublons existants avant de créer.
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
    const syncMark = `Prélèvement Crédit: ${liability.name}`;

    // 2. Récupérer toutes les transactions existantes pour ce passif ce mois-ci
    const { data: existing } = await supabase
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("account_id", liability.account_id)
      .eq("description", syncMark)
      .gte("date", start)
      .lte("date", end)
      .order("created_at", { ascending: true });

    if (existing && existing.length > 0) {
      // 3. Supprimer les doublons (garder la première)
      if (existing.length > 1) {
        const duplicateIds = existing.slice(1).map((t) => t.id);
        await supabase.from("transactions").delete().in("id", duplicateIds);
        console.log(`Doublons supprimés pour ${liability.name}: ${duplicateIds.length} supprimé(s)`);
      }
      // Transaction déjà présente, rien à créer
      continue;
    }

    // 4. Créer la transaction de débit
    await supabase.from("transactions").insert({
      user_id: userId,
      account_id: liability.account_id,
      amount: liability.monthly_payment,
      flow: "expense",
      date: format(new Date(), "yyyy-MM-dd"),
      description: syncMark,
      note: `Généré automatiquement depuis le passif #${liability.id}`,
      is_reviewed: false,
    });

    console.log(`Auto-débit généré pour : ${liability.name}`);
  }
}
