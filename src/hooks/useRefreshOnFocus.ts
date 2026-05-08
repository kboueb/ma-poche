import { useEffect, useRef } from "react";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";

/**
 * Re-fetches all core data when the PWA comes back to foreground.
 * Handles two cases:
 *  1. `visibilitychange` — user switches back to the app tab / PWA
 *  2. `focus` — window regains focus (desktop)
 */
export function useRefreshOnFocus() {
  const fetchTx = useTransactionsStore((s) => s.fetch);
  const fetchAcc = useAccountsStore((s) => s.fetch);
  const fetchCat = useCategoriesStore((s) => s.fetch);

  // Track the last refresh time to avoid hammering the API
  const lastRefresh = useRef<number>(0);
  const MIN_INTERVAL_MS = 30_000; // 30 seconds minimum between refreshes

  useEffect(() => {
    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh.current < MIN_INTERVAL_MS) return;
      lastRefresh.current = now;

      // Re-fetch all stores in parallel
      Promise.all([fetchTx(), fetchAcc(), fetchCat()]).catch(console.error);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const handleFocus = () => refresh();

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [fetchTx, fetchAcc, fetchCat]);
}
