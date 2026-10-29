import { Suspense, lazy, useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Toaster } from "sonner";
import { useAuthStore } from "@/stores/useAuthStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import CommandPalette from "@/components/layout/CommandPalette";
import ShortcutsHelp from "@/components/layout/ShortcutsHelp";
import GlobalTransactionModal from "@/components/layout/GlobalTransactionModal";
import TimerWidget from "@/components/layout/TimerWidget";
import { initGlobalShortcuts } from "@/stores/useUIStore";
import { GuidedTour } from "@/components/layout/GuidedTour";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { useThemeStore } from "@/stores/useThemeStore";
import { Logo } from "@/components/ui/Logo";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import UpdateBanner from "@/components/layout/UpdateBanner";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import { useDueReminders } from "@/hooks/useDueReminders";
import LoginPage from "./LoginPage";
import ResetPasswordPage from "./ResetPasswordPage";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("@/features/analytics/DashboardPage"));
const TransactionsPage = lazy(() => import("@/features/transactions/TransactionsPage"));
const BudgetsPage = lazy(() => import("@/features/budgets/BudgetsPage"));
const PatrimoinePage = lazy(() => import("@/features/assets/PatrimoinePage"));
const GoalsPage = lazy(() => import("@/features/goals/GoalsPage"));
const CategoriesPage = lazy(() => import("@/features/categories/CategoriesPage"));
const AccountsPage = lazy(() => import("@/features/accounts/AccountsPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const ReportsPage = lazy(() => import("@/features/analytics/ReportsPage"));
const RecurringTransactionsPage = lazy(() => import("@/features/transactions/RecurringTransactionsPage"));
const SchedulePage = lazy(() => import("@/features/schedule/SchedulePage"));
const DebtSimulatorPage = lazy(() => import("@/features/assets/DebtSimulatorPage"));
const ProjectsPage = lazy(() => import("@/features/projects/ProjectsPage"));
const TimePage = lazy(() => import("@/features/time/TimePage"));
const InvoicesPage = lazy(() => import("@/features/invoices/InvoicesPage"));

function PageLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
      <Logo size="md" className="animate-pulse" />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
      >
        <Routes location={location}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="/patrimoine" element={<PatrimoinePage />} />
          <Route path="/rapports" element={<ReportsPage />} />
          <Route path="/recurrentes" element={<RecurringTransactionsPage />} />
          <Route path="/echeancier" element={<SchedulePage />} />
          <Route path="/simulateur" element={<DebtSimulatorPage />} />
          <Route path="/missions" element={<ProjectsPage />} />
          <Route path="/temps" element={<TimePage />} />
          <Route path="/factures" element={<InvoicesPage />} />
          <Route path="/objectifs" element={<GoalsPage />} />
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

function AuthenticatedLayout() {
  // Auto-refresh data when PWA comes back to foreground
  useRefreshOnFocus();

  // Rappels d'échéances et factures en retard, quelle que soit la page ouverte
  useDueReminders();

  // Raccourcis clavier globaux (⌘K, N, ?)
  useEffect(() => initGlobalShortcuts(), []);

  return (
    <div className="min-h-screen flex">
      <GuidedTour />
      <Sidebar />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <AnimatedRoutes />
        </Suspense>
      </main>
      <BottomNav />
      <CommandPalette />
      <ShortcutsHelp />
      <GlobalTransactionModal />
      <TimerWidget />
    </div>
  );
}

export default function App() {
  const { user, loading, init } = useAuthStore();
  const theme = useThemeStore((s) => s.theme);
  const [showSplash, setShowSplash] = useState(true);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    const root = window.document.documentElement;
    const isSwitch = root.classList.contains("dark") !== (theme === "dark");
    // Fondu des couleurs seulement lors d'un changement (pas au premier rendu, pas en permanence)
    if (isSwitch) root.classList.add("theme-switching");
    root.classList.toggle("dark", theme === "dark");
    if (!isSwitch) return;
    const t = setTimeout(() => root.classList.remove("theme-switching"), 300);
    return () => clearTimeout(t);
  }, [theme]);

  const handleSplashDone = useCallback(() => {
    setSplashDone(true);
    // Small delay so the fade-out animation completes
    setTimeout(() => setShowSplash(false), 100);
  }, []);

  // Show splash during initial auth check or for at least the splash duration
  const isReady = splashDone && !loading;

  return (
    <>
      {showSplash && <SplashScreen onDone={handleSplashDone} />}
      <Toaster position="top-center" richColors closeButton theme={theme} />
      <UpdateBanner />

      {/* Main app — renders underneath, visible once splash is gone */}
      <div
        className={`transition-opacity duration-500 ${
          isReady ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <BrowserRouter>
          <ErrorBoundary>
            <Routes>
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              {user ? (
                <Route path="*" element={<AuthenticatedLayout />} />
              ) : (
                <Route path="*" element={<LoginPage />} />
              )}
            </Routes>
          </ErrorBoundary>
        </BrowserRouter>
      </div>
    </>
  );
}
