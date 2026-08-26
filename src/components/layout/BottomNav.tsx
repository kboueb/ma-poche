import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, ArrowLeftRight, PieChart, Plus, Settings } from "lucide-react";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { Modal } from "@/components/ui/Modal";
import TransactionForm from "@/features/transactions/TransactionForm";

const MORE_TABS = [
  { to: "/rapports", icon: "📊", label: "Rapports" },
  { to: "/recurrentes", icon: "🔁", label: "Récurrentes" },
  { to: "/budgets", icon: "📈", label: "Budgets" },
  { to: "/patrimoine", icon: "🏦", label: "Patrimoine" },
  { to: "/objectifs", icon: "🎯", label: "Objectifs" },
  { to: "/accounts", icon: "💳", label: "Comptes" },
  { to: "/categories", icon: "🏷️", label: "Catégories" },
  { to: "/settings", icon: "⚙️", label: "Réglages" },
];

export function BottomNav() {
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const { accounts, fetch: fetchAcc } = useAccountsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();
  const { fetch: fetchTx } = useTransactionsStore();

  useEffect(() => {
    fetchAcc();
    fetchCat();
  }, [fetchAcc, fetchCat]);

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-1/95 backdrop-blur-lg border-t border-surface-3 safe-area-pb">
        <div className="grid grid-cols-5 items-center h-16">
          <NavLink to="/" end className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-1 transition-colors ${isActive ? "text-brand-400" : "text-text-muted"}`}>
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">Accueil</span>
          </NavLink>

          <NavLink to="/transactions" className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-1 transition-colors ${isActive ? "text-brand-400" : "text-text-muted"}`}>
            <ArrowLeftRight className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">Txns</span>
          </NavLink>

          {/* Center FAB */}
          <div className="flex items-center justify-center">
            <button
              onClick={() => setTxModalOpen(true)}
              className="w-11 h-11 -mt-5 bg-brand-500 hover:bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-500/25 transition-transform active:scale-95"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          <NavLink to="/budgets" className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-1 transition-colors ${isActive ? "text-brand-400" : "text-text-muted"}`}>
            <PieChart className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">Budgets</span>
          </NavLink>

          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 transition-colors text-text-muted"
          >
            <Settings className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">Plus</span>
          </button>
        </div>
      </nav>

      {/* More menu modal */}
      <Modal isOpen={moreOpen} onClose={() => setMoreOpen(false)} title="Navigation" size="sm">
        <div className="space-y-3">
          {Array.from({ length: Math.ceil(MORE_TABS.length / 2) }, (_, rowIdx) => {
            const row = MORE_TABS.slice(rowIdx * 2, rowIdx * 2 + 2);
            const isLastRow = rowIdx === Math.floor(MORE_TABS.length / 2);
            const isSingle = isLastRow && MORE_TABS.length % 2 !== 0;
            return (
              <div key={rowIdx} className={`grid gap-3 ${isSingle ? "grid-cols-1" : "grid-cols-2"}`}>
                {row.map(({ to, icon, label }) => (
                  <button
                    key={to}
                    onClick={() => { navigate(to); setMoreOpen(false); }}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-surface-2 hover:bg-surface-3 transition-colors"
                  >
                    <span className="text-2xl">{icon}</span>
                    <span className="text-xs font-semibold">{label}</span>
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Quick Add Transaction Modal */}
      <Modal isOpen={txModalOpen} onClose={() => setTxModalOpen(false)} title="Nouvelle transaction">
        <TransactionForm
          onClose={() => {
            setTxModalOpen(false);
            fetchTx();
            fetchAcc();
          }}
          accounts={accounts}
          categories={categories}
        />
      </Modal>
    </>
  );
}
