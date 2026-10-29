import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ArrowLeftRight, Repeat, Wallet, PieChart, Building2,
  BarChart3, Target, Tag, Settings, Plus, Search, ArrowUpRight, ArrowDownRight,
  Briefcase, Timer, ReceiptText, Users, FileSignature,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/stores/useUIStore";
import TransactionForm from "@/features/transactions/TransactionForm";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/dates";

const NAV_ACTIONS = [
  { to: "/", label: "Tableau de bord", keywords: "accueil dashboard home", Icon: LayoutDashboard },
  { to: "/transactions", label: "Transactions", keywords: "transaction depenses depenses", Icon: ArrowLeftRight },
  { to: "/missions", label: "Missions", keywords: "mission projet client consultance freelance", Icon: Briefcase },
  { to: "/temps", label: "Temps de travail", keywords: "temps timer horaire heures facturation", Icon: Timer },
  { to: "/factures", label: "Factures", keywords: "facture billing paiement", Icon: ReceiptText },
  { to: "/clients", label: "Clients", keywords: "client contact entreprise siret", Icon: Users },
  { to: "/devis", label: "Devis", keywords: "devis proposition offre chiffrage", Icon: FileSignature },
  { to: "/recurrentes", label: "Transactions récurrentes", keywords: "recurrent abonnement", Icon: Repeat },
  { to: "/accounts", label: "Comptes", keywords: "compte banque", Icon: Wallet },
  { to: "/budgets", label: "Budgets", keywords: "budget limite", Icon: PieChart },
  { to: "/patrimoine", label: "Patrimoine", keywords: "patrimoine actif passif net", Icon: Building2 },
  { to: "/rapports", label: "Rapports", keywords: "rapport comparaison mois", Icon: BarChart3 },
  { to: "/objectifs", label: "Objectifs", keywords: "objectif epargne but", Icon: Target },
  { to: "/categories", label: "Catégories", keywords: "categorie", Icon: Tag },
  { to: "/settings", label: "Réglages", keywords: "reglage parametre setting export", Icon: Settings },
];

export default function CommandPalette() {
  const open = useUIStore((s) => s.paletteOpen);
  const setOpen = useUIStore((s) => s.setPaletteOpen);
  const txModalOpen = useUIStore((s) => s.txModalOpen);
  const setTxModalOpen = useUIStore((s) => s.setTxModalOpen);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const { accounts, fetch: fetchAcc } = useAccountsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlight(0);
      fetchTx(); fetchAcc(); fetchCat();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, fetchTx, fetchAcc, fetchCat]);

  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    type Item =
      | { kind: "action"; label: string; hint: string; Icon: typeof Plus; run: () => void }
      | { kind: "nav"; label: string; hint: string; Icon: typeof Plus; run: () => void }
      | { kind: "tx"; label: string; hint: string; Icon: typeof Plus; amount: string; run: () => void };

    const items: Item[] = [];

    items.push({
      kind: "action", label: "Nouvelle transaction", hint: "Créer",
      Icon: Plus, run: () => setTxModalOpen(true),
    });

    for (const nav of NAV_ACTIONS) {
      if (!q || nav.label.toLowerCase().includes(q) || nav.keywords.includes(q)) {
        items.push({
          kind: "nav", label: nav.label, hint: "Aller à",
          Icon: nav.Icon, run: () => navigate(nav.to),
        });
      }
    }

    if (q.length >= 2) {
      const matches = transactions
        .filter((t) =>
          (t.description || "").toLowerCase().includes(q) ||
          (t.category?.name || "").toLowerCase().includes(q) ||
          (t.amount != null && String(t.amount).includes(q))
        )
        .slice(0, 6);
      for (const t of matches) {
        const label = t.description || t.category?.name || "Sans description";
        items.push({
          kind: "tx",
          label,
          hint: `${formatDate(t.date, "d MMM")} · ${t.account?.name || ""}`,
          Icon: t.flow === "income" ? ArrowUpRight : ArrowDownRight,
          amount: `${t.flow === "income" ? "+" : "−"}${formatCurrency(Number(t.amount))}`,
          run: () => navigate(`/transactions?highlight=${t.id}`),
        });
      }
    }

    return items.slice(0, 12);
  }, [q, transactions, navigate]);

  useEffect(() => setHighlight(0), [q]);

  const close = () => setOpen(false);

  const runItem = (index: number) => {
    const item = results[index];
    if (!item) return;
    close();
    // Laisse le modal se fermer avant d'ouvrir le formulaire
    setTimeout(() => item.run(), 50);
  };

  return (
    <>
      <Modal isOpen={open} onClose={close} title="" size="sm">
        <div className="-m-1">
          <div className="flex items-center gap-2 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2.5 focus-within:border-brand-500 focus-within:ring-1 focus-within:ring-brand-500/30">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setHighlight((h) => Math.min(h + 1, results.length - 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setHighlight((h) => Math.max(h - 1, 0)); }
                if (e.key === "Enter") runItem(highlight);
              }}
              placeholder="Rechercher, naviguer, créer..."
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-muted"
            />
            <kbd className="text-[10px] text-text-muted bg-surface-3 rounded px-1.5 py-0.5">esc</kbd>
          </div>

          <div className="mt-2 max-h-[320px] overflow-y-auto space-y-0.5">
            {results.length === 0 && (
              <p className="text-center text-xs text-text-muted py-6">Aucun résultat</p>
            )}
            {results.map((item, i) => (
              <button
                key={`${item.kind}-${item.label}-${i}`}
                onClick={() => runItem(i)}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-colors ${
                  i === highlight ? "bg-brand-500/10" : "hover:bg-surface-2"
                }`}
              >
                <item.Icon className={`w-4 h-4 shrink-0 ${item.kind === "tx" ? (item as { amount: string }).amount.startsWith("+") ? "text-emerald-400" : "text-rose-400" : "text-brand-400"}`} />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm truncate">{item.label}</span>
                  <span className="block text-[11px] text-text-muted truncate">{item.hint}</span>
                </span>
                {item.kind === "tx" && (
                  <span className="text-xs font-mono font-bold shrink-0">{(item as { amount: string }).amount}</span>
                )}
                {item.kind !== "tx" && (
                  <span className="text-[10px] text-text-muted shrink-0">{item.hint}</span>
                )}
              </button>
            ))}
          </div>

          <p className="text-[10px] text-text-muted text-center pt-2">
            {navigator.platform.toUpperCase().includes("MAC") ? "⌘K" : "Ctrl+K"} pour ouvrir · ↑↓ naviguer · ↵ valider
          </p>
        </div>
      </Modal>

      <Modal isOpen={txModalOpen} onClose={() => setTxModalOpen(false)} title="Nouvelle transaction">
        <TransactionForm
          onClose={() => { setTxModalOpen(false); fetchTx(); fetchAcc(); }}
          accounts={accounts}
          categories={categories}
        />
      </Modal>
    </>
  );
}
