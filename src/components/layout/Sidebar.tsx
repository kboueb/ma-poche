import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, PieChart, Building2, Target, Settings, LogOut, Sun, Moon, Tag, Wallet, BarChart3, Repeat, CalendarClock, Calculator, Briefcase, Search, Timer, ReceiptText } from "lucide-react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useThemeStore } from "@/stores/useThemeStore";
import { useUIStore } from "@/stores/useUIStore";
import { isMacDesktop } from "@/lib/tauri";

const NAV_SECTIONS: Array<{ title: string; items: Array<{ to: string; icon: typeof LayoutDashboard; label: string; tourClass: string }> }> = [
  {
    title: "Pilotage",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Tableau de bord", tourClass: "" },
      { to: "/rapports", icon: BarChart3, label: "Rapports", tourClass: "" },
    ],
  },
  {
    title: "Argent",
    items: [
      { to: "/transactions", icon: ArrowLeftRight, label: "Transactions", tourClass: "tour-nav-transactions" },
      { to: "/recurrentes", icon: Repeat, label: "Récurrentes", tourClass: "" },
      { to: "/accounts", icon: Wallet, label: "Comptes", tourClass: "tour-nav-accounts" },
      { to: "/budgets", icon: PieChart, label: "Budgets", tourClass: "tour-nav-budgets" },
      { to: "/echeancier", icon: CalendarClock, label: "Échéancier", tourClass: "" },
      { to: "/patrimoine", icon: Building2, label: "Patrimoine", tourClass: "tour-nav-patrimoine" },
      { to: "/simulateur", icon: Calculator, label: "Simulateur dettes", tourClass: "" },
    ],
  },
  {
    title: "Activité",
    items: [
      { to: "/missions", icon: Briefcase, label: "Missions", tourClass: "" },
      { to: "/temps", icon: Timer, label: "Temps", tourClass: "" },
      { to: "/factures", icon: ReceiptText, label: "Factures", tourClass: "" },
      { to: "/objectifs", icon: Target, label: "Objectifs", tourClass: "tour-nav-objectifs" },
    ],
  },
  {
    title: "Système",
    items: [
      { to: "/categories", icon: Tag, label: "Catégories", tourClass: "" },
    ],
  },
];

import { Logo } from "@/components/ui/Logo";

export function Sidebar() {
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggle: toggleTheme } = useThemeStore();
  const setPaletteOpen = useUIStore((s) => s.setPaletteOpen);
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  // En app desktop macOS, la titlebar est en overlay : espace pour les traffic lights + zone de drag
  const macOverlay = isMacDesktop();

  return (
    <aside className="hidden md:flex flex-col w-64 h-screen bg-surface-1 border-r border-surface-3 fixed left-0 top-0 z-40">
      {/* Logo — draggable en mode desktop macOS */}
      <div
        className={`p-6 pb-2 ${macOverlay ? "pt-10 pl-20" : ""}`}
        {...(macOverlay ? { "data-tauri-drag-region": true } : {})}
      >
        <Logo size="sm" className="!items-start" />
      </div>

      {/* Recherche globale */}
      <div className="px-3 mt-4">
        <button
          onClick={() => setPaletteOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-text-muted bg-surface-2 hover:bg-surface-3 hover:text-text-secondary transition-all border border-surface-3"
        >
          <Search className="w-[18px] h-[18px]" />
          <span className="flex-1 text-left">Rechercher...</span>
          <kbd className="text-[10px] font-mono text-text-muted bg-surface-3 border border-surface-4 rounded-md px-1.5 py-0.5">
            {isMac ? "⌘K" : "Ctrl+K"}
          </kbd>
        </button>
      </div>

      <nav className="flex-1 flex flex-col gap-4 p-3 mt-2 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="px-4 mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-muted/70">
              {section.title}
            </p>
            <div className="flex flex-col gap-1">
              {section.items.map(({ to, icon: Icon, label, tourClass }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === "/"}
                  className={({ isActive }) =>
                    `${tourClass} flex items-center gap-3 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-brand-500/10 text-brand-400 border border-brand-500/20"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-2 border border-transparent"
                    }`
                  }
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{label}</span>
                </NavLink>
              ))}
            </div>
          </div>
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
