import { supabase } from "./supabase";

const DEFAULT_CATEGORIES = [
  // Dépenses
  { name: "Logement", icon: "🏠", color: "#6366f1", flow: "expense" },
  { name: "Alimentation", icon: "🛒", color: "#10b981", flow: "expense" },
  { name: "Transport", icon: "🚗", color: "#3b82f6", flow: "expense" },
  { name: "Santé", icon: "💊", color: "#ef4444", flow: "expense" },
  { name: "Loisirs", icon: "🎮", color: "#f59e0b", flow: "expense" },
  { name: "Shopping", icon: "🛍️", color: "#ec4899", flow: "expense" },
  { name: "Restaurants", icon: "🍽️", color: "#f97316", flow: "expense" },
  { name: "Abonnements", icon: "📱", color: "#8b5cf6", flow: "expense" },
  { name: "Éducation", icon: "📚", color: "#14b8a6", flow: "expense" },
  { name: "Cadeaux", icon: "🎁", color: "#d946ef", flow: "expense" },
  { name: "Assurances", icon: "🛡️", color: "#64748b", flow: "expense" },
  { name: "Impôts & taxes", icon: "🏛️", color: "#78716c", flow: "expense" },
  { name: "Divers", icon: "📦", color: "#94a3b8", flow: "expense" },
  // Revenus
  { name: "Salaire", icon: "💰", color: "#10b981", flow: "income" },
  { name: "Freelance", icon: "💻", color: "#6366f1", flow: "income" },
  { name: "Investissements", icon: "📈", color: "#3b82f6", flow: "income" },
  { name: "Aides & allocations", icon: "🏦", color: "#14b8a6", flow: "income" },
  { name: "Remboursements", icon: "↩️", color: "#f59e0b", flow: "income" },
  { name: "Autres revenus", icon: "✨", color: "#8b5cf6", flow: "income" },
];

export async function seedDefaultCategories(userId: string): Promise<void> {
  // Fetch existing category names for this user
  const { data: existing } = await supabase
    .from("categories")
    .select("name")
    .eq("user_id", userId);

  const existingNames = new Set(existing?.map(c => c.name) || []);

  // Filter out categories that already exist
  const toInsert = DEFAULT_CATEGORIES
    .filter(c => !existingNames.has(c.name))
    .map((c) => ({
      user_id: userId,
      name: c.name,
      icon: c.icon,
      color: c.color,
      flow: c.flow,
      parent_id: null,
    }));

  if (toInsert.length > 0) {
    await supabase.from("categories").insert(toInsert);
  }
}

export async function seedDefaultAccounts(userId: string): Promise<void> {
  const { count } = await supabase
    .from("accounts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (count && count > 0) return;

  await supabase.from("accounts").insert({
    user_id: userId,
    name: "Compte Courant",
    type: "checking",
    institution: "Ma Banque",
    initial_balance: 0,
    current_balance: 0,
    currency: "XOF",
    color: "#10b981",
  });
}
