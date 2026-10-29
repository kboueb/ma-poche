import { useEffect } from "react";
import { format } from "date-fns";
import { supabase } from "@/lib/supabase";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useProjectsStore } from "@/stores/useProjectsStore";
import { useInvoicesStore } from "@/stores/useInvoicesStore";
import { computeUpcomingPayments } from "@/lib/utils/upcomingPayments";
import { buildReminderDigest, alreadyNotified, recordNotified, type NotifiedLog } from "@/lib/utils/reminders";
import { hasNotificationPermission, sendNotification } from "@/lib/services/notificationService";
import type { Liability } from "@/types";

const LOG_KEY = "mapoche-schedule-notified";
const FIRST_CHECK_MS = 5_000;
const CHECK_EVERY_MS = 60 * 60 * 1000;

function readLog(): NotifiedLog | null {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || "null");
  } catch {
    return null;
  }
}

function writeLog(log: NotifiedLog) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // ignore
  }
}

/** Charge ce qui manque (une page peut déjà l'avoir fait) puis notifie les échéances, une fois par jour. */
async function checkReminders() {
  if (!(await hasNotificationPermission())) return;

  const tx = useTransactionsStore.getState();
  const acc = useAccountsStore.getState();
  const cat = useCategoriesStore.getState();
  const proj = useProjectsStore.getState();
  const inv = useInvoicesStore.getState();
  await Promise.all([
    tx.transactions.length ? null : tx.fetch(),
    acc.accounts.length ? null : acc.fetch(),
    cat.categories.length ? null : cat.fetch(),
    proj.projects.length ? null : proj.fetch(),
    inv.invoices.length ? null : inv.fetch(),
  ]);
  const { data } = await supabase.from("liabilities").select("*");

  const upcoming = computeUpcomingPayments(
    useTransactionsStore.getState().transactions,
    (data as Liability[]) || [],
    useAccountsStore.getState().accounts,
    useCategoriesStore.getState().categories,
    3,
    useProjectsStore.getState().projects,
    useProjectsStore.getState().milestones,
    useInvoicesStore.getState().invoices,
  );

  const today = format(new Date(), "yyyy-MM-dd");
  let log = readLog();
  for (const n of buildReminderDigest(upcoming)) {
    if (alreadyNotified(log, today, n.ids)) continue;
    await sendNotification(n.title, n.body);
    log = recordNotified(log, today, n.ids);
    writeLog(log);
  }
}

/** Rappels d'échéances actifs dans toute l'app (pas seulement sur la page Échéancier). */
export function useDueReminders() {
  const enabled = useSettingsStore((s) => s.remindersEnabled);

  useEffect(() => {
    if (!enabled) return;
    const run = () => checkReminders().catch(() => {});
    const first = setTimeout(run, FIRST_CHECK_MS);
    const every = setInterval(run, CHECK_EVERY_MS);
    return () => { clearTimeout(first); clearInterval(every); };
  }, [enabled]);
}
