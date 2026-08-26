import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, PieChart, Building2, Target, Settings, LogOut, Sun, Moon, Tag, Wallet, BarChart3, Repeat } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useThemeStore } from "@/stores/useThemeStore";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Tableau de bord", tourClass: "" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions", tourClass: "tour-nav-transactions" },
  { to: "/recurrentes", icon: Repeat, label: "Récurrentes", tourClass: "" },
  { to: "/accounts", icon: Wallet, label: "Comptes", tourClass: "tour-nav-accounts" },
  { to: "/budgets", icon: PieChart, label: "Budgets", tourClass: "tour-nav-budgets" },
  { to: "/patrimoine", icon: Building2, label: "Patrimoine", tourClass: "tour-nav-patrimoine" },
  { to: "/rapports", icon: BarChart3, label: "Rapports", tourClass: "" },
  { to: "/objectifs", icon: Target, label: "Objectifs", tourClass: "tour-nav-objectifs" },
  { to: "/categories", icon: Tag, label: "Catégories", tourClass: "" },
];

import { Logo } from "@/components/ui/Logo";

export function Sidebar() {
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle: toggleTheme } = useThemeStore();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-surface-1 border-r border-surface-3 fixed left-0 top-0 z-40">
      {/* Logo */}
      <div className="p-6 pb-2">
        <Logo size="sm" className="!items-start" />
      </div>

      <nav className="flex-1 flex flex-col gap-1 p-3 mt-4">
        {NAV.map(({ to, icon: Icon, label, tourClass }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `${tourClass} flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? "bg-brand-500/10 text-brand-400 border border-brand-500/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
              }`
            }
          >
            <Icon className="w-[18px] h-[18px]" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-surface-3 space-y-1">
        <NavLink to="/settings" className="tour-settings flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-all">
          <Settings className="w-[18px] h-[18px]" />
          <span>Réglages</span>
        </NavLink>
        <button onClick={toggleTheme} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-all">
          {theme === "dark" ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          <span>{theme === "dark" ? "Mode clair" : "Mode sombre"}</span>
        </button>
        <button onClick={logout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-rose-400 hover:bg-rose-500/10 transition-all">
          <LogOut className="w-[18px] h-[18px]" />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
