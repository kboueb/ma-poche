import { supabase } from "@/lib/supabase";
import { convertToBase } from "@/lib/utils/currency";

export async function recordPatrimoineSnapshot(userId: string): Promise<void> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

  const { count } = await supabase
    .from("patrimoine_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("recorded_at", startOfDay);

  if (count && count > 0) return;

  const [{ data: accounts }, { data: assets }, { data: liabilities }] = await Promise.all([
    supabase.from("accounts").select("current_balance, currency").eq("user_id", userId),
    supabase.from("assets").select("current_value, currency").eq("user_id", userId),
    supabase.from("liabilities").select("remaining_amount").eq("user_id", userId),
  ]);

  const accountBalances = (accounts || []).reduce(
    (sum, a) => sum + convertToBase(Number(a.current_balance || 0), a.currency || "XOF"),
    0
  );
  const totalAssets = (assets || []).reduce(
    (sum, a) => sum + convertToBase(Number(a.current_value || 0), a.currency || "XOF"),
    0
  );
  const totalLiabilities = (liabilities || []).reduce(
    (sum, l) => sum + Number(l.remaining_amount || 0),
    0
  );

  const netWorth = totalAssets - totalLiabilities;

  await supabase.from("patrimoine_snapshots").insert({
    user_id: userId,
    total_assets: totalAssets,
    total_liabilities: totalLiabilities,
    net_worth: netWorth,
    account_balances: accountBalances,
  });
}
