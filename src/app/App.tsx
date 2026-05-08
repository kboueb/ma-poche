import { Suspense, lazy, useEffect, useState, useCallback } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { GuidedTour } from "@/components/layout/GuidedTour";
import { SplashScreen } from "@/components/ui/SplashScreen";
import { useThemeStore } from "@/stores/useThemeStore";
import { Logo } from "@/components/ui/Logo";
import { useRefreshOnFocus } from "@/hooks/useRefreshOnFocus";
import LoginPage from "./LoginPage";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("@/features/analytics/DashboardPage"));
const TransactionsPage = lazy(() => import("@/features/transactions/TransactionsPage"));
const BudgetsPage = lazy(() => import("@/features/budgets/BudgetsPage"));
const PatrimoinePage = lazy(() => import("@/features/assets/PatrimoinePage"));
const GoalsPage = lazy(() => import("@/features/goals/GoalsPage"));
const CategoriesPage = lazy(() => import("@/features/categories/CategoriesPage"));
const AccountsPage = lazy(() => import("@/features/accounts/AccountsPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));

function PageLoader() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-in fade-in duration-500">
      <Logo size="md" className="animate-pulse" />
    </div>
  );
}

function AuthenticatedLayout() {
  // Auto-refresh data when PWA comes back to foreground
  useRefreshOnFocus();

  return (
    <div className="min-h-screen flex">
      <GuidedTour />
      <Sidebar />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/patrimoine" element={<PatrimoinePage />} />
            <Route path="/objectifs" element={<GoalsPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
      <BottomNav />
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
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
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

      {/* Main app — renders underneath, visible once splash is gone */}
      <div
        className={`transition-opacity duration-500 ${
          isReady ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <BrowserRouter>
          {user ? <AuthenticatedLayout /> : (
            <Routes>
              <Route path="*" element={<LoginPage />} />
            </Routes>
          )}
        </BrowserRouter>
      </div>
    </>
  );
}
