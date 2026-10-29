import {
  House, ShoppingCart, Car, Pill, Gamepad2, ShoppingBag, UtensilsCrossed,
  Smartphone, BookOpen, Gift, Shield, Landmark, Package, Sparkles,
  CircleDollarSign, Laptop, TrendingUp, Undo2, Banknote, CreditCard,
  GraduationCap, Lightbulb, Folder, Target, Hand, Mail, Lock, Rocket,
  PartyPopper, Settings, Plus, Tag, BarChart3, Repeat, CalendarDays,
  Calculator, ReceiptText, Briefcase, Image, TriangleAlert, Snowflake,
  Flame, Bitcoin, Wallet, Wrench, Plane, Heart, Coffee, Music, Dumbbell,
  PiggyBank,
  type LucideIcon,
} from "lucide-react";

/**
 * Icône applicative unifiée — ZÉRO emoji dans l'UI.
 * Accepte un emoji historique (données existantes) ou un nom logique
 * (nouvelles données), et rend toujours un composant Lucide.
 */

// Emojis historiques (catégories seedées, types, anciennes données) → Lucide
const EMOJI_MAP: Record<string, LucideIcon> = {
  "🏠": House,
  "🛒": ShoppingCart,
  "🚗": Car,
  "💊": Pill,
  "🎮": Gamepad2,
  "🛍": ShoppingBag,
  "🍽": UtensilsCrossed,
  "📱": Smartphone,
  "📚": BookOpen,
  "🎁": Gift,
  "🛡": Shield,
  "🏛": Landmark,
  "📦": Package,
  "💰": CircleDollarSign,
  "💻": Laptop,
  "📈": TrendingUp,
  "🏦": Landmark,
  "↩": Undo2,
  "✨": Sparkles,
  "💵": Banknote,
  "💳": CreditCard,
  "🎓": GraduationCap,
  "🏡": House,
  "💡": Lightbulb,
  "📁": Folder,
  "🎯": Target,
  "👋": Hand,
  "📩": Mail,
  "🔒": Lock,
  "🚀": Rocket,
  "🎉": PartyPopper,
  "⚙": Settings,
  "➕": Plus,
  "🏷": Tag,
  "📊": BarChart3,
  "🔁": Repeat,
  "🗓": CalendarDays,
  "🧮": Calculator,
  "🧾": ReceiptText,
  "💼": Briefcase,
  "🖼": Image,
  "⚠": TriangleAlert,
  "❄": Snowflake,
  "🔥": Flame,
  "₿": Bitcoin,
};

// Noms logiques (nouvelles données : picker d'icônes) → Lucide
const NAME_MAP: Record<string, LucideIcon> = {
  house: House,
  cart: ShoppingCart,
  car: Car,
  pill: Pill,
  gamepad: Gamepad2,
  bag: ShoppingBag,
  utensils: UtensilsCrossed,
  phone: Smartphone,
  book: BookOpen,
  gift: Gift,
  shield: Shield,
  landmark: Landmark,
  package: Package,
  sparkles: Sparkles,
  salary: CircleDollarSign,
  laptop: Laptop,
  trending: TrendingUp,
  bank: Landmark,
  refund: Undo2,
  cash: Banknote,
  card: CreditCard,
  graduation: GraduationCap,
  idea: Lightbulb,
  folder: Folder,
  target: Target,
  settings: Settings,
  tag: Tag,
  wallet: Wallet,
  wrench: Wrench,
  plane: Plane,
  heart: Heart,
  coffee: Coffee,
  music: Music,
  sport: Dumbbell,
  briefcase: Briefcase,
  bitcoin: Bitcoin,
  piggy: PiggyBank,
  chart: BarChart3,
};

/** Choix proposés dans le sélecteur d'icônes (catégories, objectifs). */
export const ICON_CHOICES: Array<{ name: string; label: string; Icon: LucideIcon }> = [
  { name: "house", label: "Logement", Icon: House },
  { name: "cart", label: "Courses", Icon: ShoppingCart },
  { name: "car", label: "Transport", Icon: Car },
  { name: "pill", label: "Santé", Icon: Pill },
  { name: "gamepad", label: "Loisirs", Icon: Gamepad2 },
  { name: "bag", label: "Shopping", Icon: ShoppingBag },
  { name: "utensils", label: "Restaurant", Icon: UtensilsCrossed },
  { name: "phone", label: "Abonnement", Icon: Smartphone },
  { name: "book", label: "Éducation", Icon: BookOpen },
  { name: "gift", label: "Cadeau", Icon: Gift },
  { name: "shield", label: "Assurance", Icon: Shield },
  { name: "landmark", label: "Banque", Icon: Landmark },
  { name: "package", label: "Divers", Icon: Package },
  { name: "sparkles", label: "Divers +", Icon: Sparkles },
  { name: "salary", label: "Revenu", Icon: CircleDollarSign },
  { name: "laptop", label: "Freelance", Icon: Laptop },
  { name: "trending", label: "Investissement", Icon: TrendingUp },
  { name: "refund", label: "Remboursement", Icon: Undo2 },
  { name: "cash", label: "Espèces", Icon: Banknote },
  { name: "card", label: "Carte", Icon: CreditCard },
  { name: "briefcase", label: "Travail", Icon: Briefcase },
  { name: "target", label: "Objectif", Icon: Target },
  { name: "plane", label: "Voyage", Icon: Plane },
  { name: "heart", label: "Perso", Icon: Heart },
  { name: "coffee", label: "Café", Icon: Coffee },
  { name: "music", label: "Musique", Icon: Music },
  { name: "sport", label: "Sport", Icon: Dumbbell },
  { name: "idea", label: "Idée", Icon: Lightbulb },
  { name: "wallet", label: "Portefeuille", Icon: Wallet },
  { name: "wrench", label: "Bricolage", Icon: Wrench },
];

export function resolveIcon(icon: string | null | undefined): LucideIcon {
  if (!icon) return Tag;
  const noVS16 = icon.replace(/\uFE0F/g, "");
  return EMOJI_MAP[noVS16] || NAME_MAP[icon.toLowerCase()] || Tag;
}

export default function AppIcon({ icon, className }: { icon: string | null | undefined; className?: string }) {
  const Cmp = resolveIcon(icon);
  return <Cmp className={className} />;
}
