import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, PieChart, Building2, Target } from "lucide-react";

const TABS = [
  { to: "/", icon: LayoutDashboard, label: "Accueil" },
  { to: "/transactions", icon: ArrowLeftRight, label: "Transactions" },
  { to: "/budgets", icon: PieChart, label: "Budgets" },
  { to: "/patrimoine", icon: Building2, label: "Patrimoine" },
  { to: "/objectifs", icon: Target, label: "Objectifs" },
];

export function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-1/95 backdrop-blur-lg border-t border-surface-3 safe-area-pb">
      <div className="flex justify-around items-center h-16">
        {TABS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-colors min-w-[52px] ${
                isActive ? "text-brand-400" : "text-text-muted"
              }`
            }
          >
            <Icon className="w-5 h-5" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
