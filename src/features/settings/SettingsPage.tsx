import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/useAuthStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { User, Shield, Download, Trash2, Globe, Moon, Sun, CheckCircle2, Compass } from "lucide-react";
import { useThemeStore } from "@/stores/useThemeStore";
import { useSettingsStore } from "@/stores/useSettingsStore";
import { useRestartTour } from "@/components/layout/GuidedTour";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const { user, logout } = useAuthStore();
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const { currency, language, setCurrency, setLanguage } = useSettingsStore();
  const restartTour = useRestartTour();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchTx();
  }, [fetchTx]);

  const handleExportCSV = () => {
    setExporting(true);
    try {
      if (transactions.length === 0) {
        alert("Aucune transaction à exporter.");
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

      const csvContent = [
        headers.join(","),
        ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
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
      alert("Erreur lors de l'exportation.");
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Réglages</h1>
        <p className="text-text-muted text-sm mt-1">Gérez votre compte et vos préférences</p>
      </div>

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
            <Button variant="secondary" size="sm">Changer d'e-mail</Button>
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
            <Select 
              label="Langue" 
              options={[
                { value: "fr", label: "Français" },
                { value: "en", label: "English" }
              ]} 
              value={language}
              onChange={(e) => handleSaveSetting(setLanguage, e.target.value)}
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
            <Button variant="ghost" className="text-rose-400 hover:bg-rose-500/10" icon={<Trash2 className="w-4 h-4" />}>
              Supprimer
            </Button>
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
