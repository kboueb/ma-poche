import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { LayoutDashboard, ArrowLeftRight, Briefcase, Plus, Settings, BarChart3, Repeat, CalendarClock, Calculator, PieChart, Building2, Target, Tag, Timer, ReceiptText } from "lucide-react";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useUIStore } from "@/stores/useUIStore";
import { Modal } from "@/components/ui/Modal";

const MORE_SECTIONS: Array<{ title: string; items: Array<{ to: string; Icon: typeof Timer; label: string }> }> = [
  {
    title: "Activité",
    items: [
      { to: "/temps", Icon: Timer, label: "Temps" },
      { to: "/factures", Icon: ReceiptText, label: "Factures" },
      { to: "/objectifs", Icon: Target, label: "Objectifs" },
    ],
  },
  {
    title: "Argent",
    items: [
      { to: "/recurrentes", Icon: Repeat, label: "Récurrentes" },
      { to: "/accounts", Icon: Building2, label: "Comptes" },
      { to: "/budgets", Icon: PieChart, label: "Budgets" },
      { to: "/echeancier", Icon: CalendarClock, label: "Échéancier" },
      { to: "/patrimoine", Icon: Building2, label: "Patrimoine" },
      { to: "/simulateur", Icon: Calculator, label: "Simulateur" },
    ],
  },
  {
    title: "Pilotage",
    items: [{ to: "/rapports", Icon: BarChart3, label: "Rapports" }],
  },
  {
    title: "Système",
    items: [
      { to: "/categories", Icon: Tag, label: "Catégories" },
      { to: "/settings", Icon: Settings, label: "Réglages" },
    ],
  },
];

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const navigate = useNavigate();
  const setTxModalOpen = useUIStore((s) => s.setTxModalOpen);
  const { fetch: fetchAcc } = useAccountsStore();
  const { fetch: fetchCat } = useCategoriesStore();

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

          <NavLink to="/missions" className={({ isActive }) => `flex flex-col items-center justify-center gap-0.5 py-1 transition-colors ${isActive ? "text-brand-400" : "text-text-muted"}`}>
            <Briefcase className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">Missions</span>
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
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-0.5">
          {MORE_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="px-1 mb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted/70">
                {section.title}
              </p>
              <div className={`grid gap-2 ${section.items.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
                {section.items.map(({ to, Icon, label }) => (
                  <button
                    key={to}
                    onClick={() => { navigate(to); setMoreOpen(false); }}
                    className="flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-surface-2 hover:bg-surface-3 transition-colors"
                  >
                    <Icon className="w-5 h-5 text-brand-400" />
                    <span className="text-[10px] font-semibold text-center leading-tight">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Quick Add Transaction Modal — global (voir GlobalTransactionModal) */}

    </>
  );
}
