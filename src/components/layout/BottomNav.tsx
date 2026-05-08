import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, ArrowLeftRight, PieChart, Building2, Plus } from "lucide-react";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { Modal } from "@/components/ui/Modal";
import TransactionForm from "@/features/transactions/TransactionForm";

const TABS = [
  { to: "/", icon: LayoutDashboard, label: "Accueil" },
  { to: "/budgets", icon: PieChart, label: "Budgets" },
  // Center is reserved for Add
  { to: "/patrimoine", icon: Building2, label: "Patrimoine" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
];

export function BottomNav() {
  const [txModalOpen, setTxModalOpen] = useState(false);
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
        <div className="flex justify-between items-center h-16 px-4">
          {TABS.slice(0, 2).map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[52px] ${isActive ? "text-brand-400" : "text-text-muted"}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold tracking-wider uppercase">{label}</span>
            </NavLink>
          ))}

          {/* Central Add Button */}
          <div className="relative -top-5">
            <button
              onClick={() => setTxModalOpen(true)}
              className="w-12 h-12 bg-brand-500 hover:bg-brand-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-500/30 transition-transform active:scale-95"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          {TABS.slice(2, 4).map(({ to, icon: Icon, label }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[52px] ${isActive ? "text-brand-400" : "text-text-muted"}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[9px] font-semibold tracking-wider uppercase">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

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
