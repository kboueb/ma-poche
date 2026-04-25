import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/useAuthStore";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { useThemeStore } from "@/stores/useThemeStore";
import { Loader2 } from "lucide-react";
import LoginPage from "./LoginPage";

// Lazy-loaded pages
const DashboardPage = lazy(() => import("@/features/analytics/DashboardPage"));
const TransactionsPage = lazy(() => import("@/features/transactions/TransactionsPage"));
const BudgetsPage = lazy(() => import("@/features/budgets/BudgetsPage"));
const PatrimoinePage = lazy(() => import("@/features/assets/PatrimoinePage"));
const GoalsPage = lazy(() => import("@/features/goals/GoalsPage"));
const CategoriesPage = lazy(() => import("@/features/categories/CategoriesPage"));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
    </div>
  );
}

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/budgets" element={<BudgetsPage />} />
            <Route path="/patrimoine" element={<PatrimoinePage />} />
            <Route path="/objectifs" element={<GoalsPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
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

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          <p className="text-xs text-text-muted uppercase tracking-widest">maPoche</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      {user ? <AuthenticatedLayout /> : (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}
