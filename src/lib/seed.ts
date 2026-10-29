import { supabase } from "./supabase";

// Les icônes sont des NOMS logiques résolus par AppIcon (Lucide).
// Les anciens emojis en base restent supportés via le mapping.
const DEFAULT_CATEGORIES = [
  // Dépenses
  { name: "Logement", icon: "house", color: "#6366f1", flow: "expense" },
  { name: "Alimentation", icon: "cart", color: "#10b981", flow: "expense" },
  { name: "Transport", icon: "car", color: "#3b82f6", flow: "expense" },
  { name: "Santé", icon: "pill", color: "#ee9a0d", flow: "expense" },
  { name: "Loisirs", icon: "gamepad", color: "#f59e0b", flow: "expense" },
  { name: "Shopping", icon: "bag", color: "#ec4899", flow: "expense" },
  { name: "Restaurants", icon: "utensils", color: "#f97316", flow: "expense" },
  { name: "Abonnements", icon: "phone", color: "#8b5cf6", flow: "expense" },
  { name: "Éducation", icon: "book", color: "#14b8a6", flow: "expense" },
  { name: "Cadeaux", icon: "gift", color: "#d946ef", flow: "expense" },
  { name: "Assurances", icon: "shield", color: "#64748b", flow: "expense" },
  { name: "Impôts & taxes", icon: "landmark", color: "#78716c", flow: "expense" },
  { name: "Divers", icon: "package", color: "#94a3b8", flow: "expense" },
  // Revenus
  { name: "Salaire", icon: "salary", color: "#10b981", flow: "income" },
  { name: "Freelance", icon: "laptop", color: "#6366f1", flow: "income" },
  { name: "Investissements", icon: "trending", color: "#3b82f6", flow: "income" },
  { name: "Aides & allocations", icon: "bank", color: "#14b8a6", flow: "income" },
  { name: "Remboursements", icon: "refund", color: "#f59e0b", flow: "income" },
  { name: "Autres revenus", icon: "sparkles", color: "#8b5cf6", flow: "income" },
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
