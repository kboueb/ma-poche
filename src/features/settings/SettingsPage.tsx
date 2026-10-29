import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { User, Shield, Download, Trash2, Globe, Moon, Sun, CheckCircle2, Compass, Briefcase, Bell, PiggyBank } from "lucide-react";
import { useCategoriesStore } from "@/stores/useCategoriesStore";
import { useTaxProvision } from "@/hooks/useTaxProvision";
import { resolveTaxCategoryIds } from "@/lib/utils/taxProvision";
import { requestNotificationPermission } from "@/lib/services/notificationService";
import { formatCurrency } from "@/lib/utils/currency";
import { useThemeStore } from "@/stores/useThemeStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useRestartTour } from "@/components/layout/GuidedTour";
import { PageHeader } from "@/components/ui/PageHeader";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const {
    currency, setCurrency,
    remindersEnabled, setRemindersEnabled,
    provisionRate, setProvisionRate,
    provisionCategoryIds, setProvisionCategoryIds,
  } = useSettingsStore();
  const { categories, fetch: fetchCat } = useCategoriesStore();
  const provision = useTaxProvision();
  const expenseCategories = categories.filter((c) => c.flow === "expense");
  const taxCategoryIds = resolveTaxCategoryIds(categories, provisionCategoryIds);
  const restartTour = useRestartTour();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [appVersion, setAppVersion] = useState("…");

  useEffect(() => {
    fetchTx();
    fetchCat();
    (async () => {
      try {
        const { isTauriRuntime } = await import("@/lib/tauri");
        if (isTauriRuntime()) {
          const { getVersion } = await import("@tauri-apps/api/app");
          setAppVersion(await getVersion());
          return;
        }
      } catch {
        // ignore → fallback ci-dessous
      }
      setAppVersion(import.meta.env.PACKAGE_VERSION || "web");
    })();
  }, [fetchTx, fetchCat]);

  const toggleReminders = async () => {
    if (remindersEnabled) {
      setRemindersEnabled(false);
      return;
    }
    const granted = await requestNotificationPermission();
    setRemindersEnabled(granted);
    if (!granted) toast.error("Notifications refusées : autorisez maPoche dans les réglages système");
  };

  const toggleTaxCategory = (id: string) => {
    const next = taxCategoryIds.includes(id) ? taxCategoryIds.filter((x) => x !== id) : [...taxCategoryIds, id];
    setProvisionCategoryIds(next);
  };

  const handleExportCSV = () => {
    setExporting(true);
    try {
      if (transactions.length === 0) {
        toast.info("Aucune transaction à exporter");
        return;
      }

      const headers = ["Date", "Description", "Montant", "Type", "Compte", "Catégorie", "Note"];
      const rows = transactions.map(t => [
        t.date,
        t.description || "",
        t.amount,
        t.flow,
        t.account?.name || "",
        t.category?.name || "",
        t.note || ""
      ]);

      // Anti formula-injection (OWASP) : neutralise les cellules interprétées par Excel/Sheets
      const escapeFormula = (cell: unknown): string => {
        const s = String(cell).replace(/"/g, '""');
        return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
      };

      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(cell => `"${escapeFormula(cell)}"`).join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `mapoche_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erreur lors de l'exportation");
    } finally {
      setExporting(false);
    }
  };

  const handleSaveSetting = (setter: (v: string) => void, val: string) => {
    setter(val);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-8">
      <PageHeader title="Réglages" subtitle="Gérez votre compte et vos préférences" />

      {/* Profil Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <User className="w-4 h-4 text-brand-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Profil</h2>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-text-muted uppercase font-semibold">Adresse e-mail</p>
              <p className="text-sm font-medium mt-1">{user?.email}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => toast.info("Fonctionnalité à venir")}>Changer d'e-mail</Button>
          </div>
        </div>
      </section>

      {/* Préférences Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-400" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Préférences</h2>
          </div>
          {saved && <span className="text-xs text-emerald-400 flex items-center gap-1 animate-in fade-in"><CheckCircle2 className="w-3.5 h-3.5"/> Enregistré</span>}
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6 space-y-6">
          <div className="grid sm:grid-cols-2 gap-6">
            <Select 
              label="Devise principale" 
              options={[
                { value: "XOF", label: "Franc CFA (XOF)" },
                { value: "EUR", label: "Euro (€)" },
                { value: "USD", label: "Dollar ($)" }
              ]} 
              value={currency}
              onChange={(e) => handleSaveSetting(setCurrency, e.target.value)}
            />
          </div>
          
          <div className="flex items-center justify-between pt-4 border-t border-surface-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center">
                {theme === "dark" ? <Moon className="w-5 h-5 text-brand-400" /> : <Sun className="w-5 h-5 text-brand-400" />}
              </div>
              <div>
                <p className="text-sm font-medium">Mode sombre</p>
                <p className="text-[11px] text-text-muted">Passer l'interface en thème sombre</p>
              </div>
            </div>
            <button 
              onClick={toggleTheme}
              className={`w-12 h-6 rounded-full transition-all relative ${theme === "dark" ? "bg-brand-500" : "bg-surface-3"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${theme === "dark" ? "left-7" : "left-1"}`} />
            </button>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-surface-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center">
                <Compass className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Visite guidée</p>
                <p className="text-[11px] text-text-muted">Relancer la présentation de l'application</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => { restartTour(); navigate("/"); }}>
              Relancer
            </Button>
          </div>
        </div>
      </section>

      {/* Freelance & rappels */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Briefcase className="w-4 h-4 text-brand-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Freelance & rappels</h2>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Rappels d'échéances</p>
                <p className="text-[11px] text-text-muted">Notification pour les paiements dus sous 3 jours et les factures clients en retard, une fois par jour</p>
              </div>
            </div>
            <button
              onClick={toggleReminders}
              role="switch"
              aria-checked={remindersEnabled}
              aria-label="Rappels d'échéances"
              className={`w-12 h-6 rounded-full transition-all relative shrink-0 ${remindersEnabled ? "bg-brand-500" : "bg-surface-3"}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${remindersEnabled ? "left-7" : "left-1"}`} />
            </button>
          </div>

          <div className="pt-4 border-t border-surface-3 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-surface-2 flex items-center justify-center shrink-0">
                  <PiggyBank className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium">Provision impôts & charges</p>
                  <p className="text-[11px] text-text-muted">Part de chaque paiement client (recette liée à une mission) à mettre de côté. 0 = désactivé.</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={provisionRate}
                  onChange={(e) => setProvisionRate(Number(e.target.value) || 0)}
                  aria-label="Taux de provision en pourcentage"
                  className="w-16 bg-surface-2 border border-surface-3 rounded-lg px-2 py-1.5 text-sm font-mono text-right focus:border-brand-500 outline-none"
                />
                <span className="text-sm text-text-muted">%</span>
              </div>
            </div>

            {provisionRate > 0 && (
              <>
                <div>
                  <p className="text-[11px] text-text-muted mb-2">Dépenses qui comptent comme impôts ou charges déjà payés :</p>
                  <div className="flex flex-wrap gap-1.5">
                    {expenseCategories.map((c) => {
                      const on = taxCategoryIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          onClick={() => toggleTaxCategory(c.id)}
                          aria-pressed={on}
                          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${on ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "border-surface-3 text-text-muted hover:text-text-primary"}`}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {provision && (
                  <div className="grid grid-cols-3 gap-3 rounded-xl bg-surface-2 p-3 text-xs">
                    <div>
                      <p className="text-text-muted">CA encaissé {new Date().getFullYear()}</p>
                      <p className="font-mono font-bold tabular-nums mt-0.5">{formatCurrency(provision.revenue)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">Déjà payé</p>
                      <p className="font-mono font-bold tabular-nums mt-0.5">{formatCurrency(provision.paid)}</p>
                    </div>
                    <div>
                      <p className="text-text-muted">À garder</p>
                      <p className="font-mono font-bold tabular-nums mt-0.5 text-amber-400">{formatCurrency(provision.outstanding)}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Données Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Shield className="w-4 h-4 text-brand-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Sécurité & Données</h2>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Exporter mes données</p>
              <p className="text-[11px] text-text-muted">Téléchargez l'historique complet de vos transactions en CSV</p>
            </div>
            <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={handleExportCSV} loading={exporting}>
              Exporter
            </Button>
          </div>

          <div className="flex items-center justify-between pt-6 border-t border-surface-3">
            <div>
              <p className="text-sm font-medium text-rose-400">Zone de danger</p>
              <p className="text-[11px] text-text-muted">Supprimer définitivement votre compte et toutes vos données</p>
            </div>
            <Button variant="ghost" className="text-rose-400 hover:bg-rose-500/10" icon={<Trash2 className="w-4 h-4" />} onClick={() => toast.info("Fonctionnalité à venir")}>
              Supprimer
            </Button>
          </div>
        </div>
      </section>

      {/* Application Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Compass className="w-4 h-4 text-brand-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-secondary">Application</h2>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Version installée</p>
              <p className="text-[11px] text-text-muted">Les mises à jour sont proposées automatiquement au lancement</p>
            </div>
            <span className="text-xs font-mono font-bold bg-surface-2 border border-surface-3 rounded-lg px-2.5 py-1">v{appVersion}</span>
          </div>
        </div>
      </section>

      <div className="pt-4 flex justify-center">
        <Button variant="ghost" className="text-text-muted text-xs" onClick={logout}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
