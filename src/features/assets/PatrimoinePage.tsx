import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { formatCurrency, formatPercent } from "@/lib/utils/currency";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Plus, Building2, TrendingUp, TrendingDown, CreditCard, Trash2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts";
import type { Asset, Liability } from "@/types";

const ASSET_TYPES = [
  { value: "real_estate", label: "🏠 Immobilier" },
  { value: "stock", label: "📈 Actions" },
  { value: "etf", label: "📊 ETF" },
  { value: "crypto", label: "₿ Crypto" },
  { value: "savings_account", label: "🏦 Épargne" },
  { value: "life_insurance", label: "🛡️ Assurance vie" },
  { value: "other", label: "📦 Autre" },
];

const LIABILITY_TYPES = [
  { value: "mortgage", label: "🏠 Crédit immo" },
  { value: "car_loan", label: "🚗 Crédit auto" },
  { value: "consumer_credit", label: "💳 Crédit conso" },
  { value: "student_loan", label: "🎓 Prêt étudiant" },
  { value: "other", label: "📦 Autre" },
];

const COLORS: Record<string, string> = {
  real_estate: "#10b981", stock: "#3b82f6", etf: "#34d399", crypto: "#f59e0b",
  savings_account: "#6366f1", life_insurance: "#8b5cf6", other: "#94a3b8",
};

export default function PatrimoinePage() {
  const { accounts, fetch: fetchAcc } = useAccountsStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [assetOpen, setAssetOpen] = useState(false);
  const [liabOpen, setLiabOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Asset form
  const [aName, setAName] = useState("");
  const [aType, setAType] = useState("real_estate");
  const [aValue, setAValue] = useState("");
  const [aPurchase, setAPurchase] = useState("");
  
  // History data
  const [history, setHistory] = useState<any[]>([]);

  // Liability form
  const [lName, setLName] = useState("");
  const [lType, setLType] = useState("mortgage");
  const [lTotal, setLTotal] = useState("");
  const [lRemaining, setLRemaining] = useState("");
  const [lRate, setLRate] = useState("");
  const [lMonthly, setLMonthly] = useState("");
  const [lAccount, setLAccount] = useState("");

  useEffect(() => { loadAll(); fetchAcc(); }, []);

  const loadAll = async () => {
    const [{ data: a }, { data: l }] = await Promise.all([
      supabase.from("assets").select("*").order("current_value", { ascending: false }),
      supabase.from("liabilities").select("*").order("remaining_amount", { ascending: false }),
    ]);
    setAssets((a as Asset[]) || []);
    setLiabilities((l as Liability[]) || []);
    
    // Load history (simulated for now if empty to show the UI)
    const { data: h } = await supabase.from("asset_history").select("*").order("recorded_at", { ascending: true });
    if (h && h.length > 0) {
      setHistory(h);
    } else {
      // Mock history for visual demo if empty
      const mockH = [
        { recorded_at: "2026-01-30", value: net * 0.8 },
        { recorded_at: "2026-02-28", value: net * 0.85 },
        { recorded_at: "2026-03-30", value: net * 0.92 },
        { recorded_at: "2026-04-27", value: net },
      ];
      setHistory(mockH);
    }
  };

  const totalAssets = useMemo(() => assets.reduce((s, a) => s + Number(a.current_value), 0), [assets]);
  const totalLiab = useMemo(() => liabilities.reduce((s, l) => s + Number(l.remaining_amount), 0), [liabilities]);
  const net = totalAssets - totalLiab;

  const donut = useMemo(() => {
    const m = new Map<string, number>();
    assets.forEach((a) => m.set(a.type, (m.get(a.type) || 0) + Number(a.current_value)));
    return Array.from(m.entries()).map(([type, value]) => ({
      name: ASSET_TYPES.find((t) => t.value === type)?.label || type,
      value, color: COLORS[type] || "#94a3b8",
    }));
  }, [assets]);

  const addAsset = async () => {
    if (!aName || !aValue) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { error } = await supabase.from("assets").insert({ 
        user_id: user.id, 
        name: aName, 
        type: aType, 
        current_value: parseFloat(aValue), 
        purchase_price: aPurchase ? parseFloat(aPurchase) : null 
      });
      if (error) {
        console.error("Erreur actif:", error);
        alert("Erreur lors de la création de l'actif: " + error.message);
      } else {
        await loadAll();
        setAssetOpen(false); setAName(""); setAValue(""); setAPurchase("");
      }
    }
    setSaving(false);
  };

  const addLiab = async () => {
    if (!lName || !lTotal || !lRemaining) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const payload: any = { 
        user_id: user.id, 
        name: lName, 
        type: lType, 
        initial_amount: parseFloat(lTotal), 
        remaining_amount: parseFloat(lRemaining), 
        interest_rate: lRate ? parseFloat(lRate) : null, 
        monthly_payment: lMonthly ? parseFloat(lMonthly) : null,
      };

      // On n'ajoute account_id que si l'utilisateur a fait un choix (pour éviter l'erreur si la colonne n'existe pas encore)
      if (lAccount) {
        payload.account_id = lAccount;
      }

      const { error } = await supabase.from("liabilities").insert(payload);
      
      if (error) {
        console.error("Erreur passif:", error);
        // Si l'erreur est spécifiquement sur account_id, on réessaie sans
        if (error.message.includes("account_id")) {
          const { account_id, ...fallbackPayload } = payload;
          const { error: retryError } = await supabase.from("liabilities").insert(fallbackPayload);
          if (retryError) {
            alert("Erreur: " + retryError.message);
          } else {
            alert("⚠️ Passif créé sans le débit auto (la colonne 'account_id' manque dans ta base Supabase).");
            await loadAll();
            setLiabOpen(false);
          }
        } else {
          alert("Erreur: " + error.message);
        }
      } else {
        await loadAll();
        setLiabOpen(false); setLName(""); setLTotal(""); setLRemaining(""); setLRate(""); setLMonthly(""); setLAccount("");
      }
    }
    setSaving(false);
  };

  const removeItem = async (table: "assets" | "liabilities", id: string) => {
    if (!confirm("Supprimer cet élément ?")) return;
    await supabase.from(table).delete().eq("id", id);
    await loadAll();
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Patrimoine</h1>

      {/* Net worth */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5 text-emerald-400" />Actifs</p>
          <p className="text-xl font-bold font-mono text-emerald-400">{formatCurrency(totalAssets)}</p>
        </div>
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><TrendingDown className="w-3.5 h-3.5 text-rose-400" />Passifs</p>
          <p className="text-xl font-bold font-mono text-rose-400">{formatCurrency(totalLiab)}</p>
        </div>
        <div className="bg-surface-1 border border-brand-500/20 rounded-2xl p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5 text-brand-400" />Net</p>
          <p className={`text-xl font-bold font-mono ${net >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{formatCurrency(net)}</p>
        </div>
      </div>
      
      {/* Evolution Chart */}
      <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6">
        <h3 className="text-sm font-semibold mb-6 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-400" /> Évolution du patrimoine net
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-3)" vertical={false} />
              <XAxis 
                dataKey="recorded_at" 
                tick={{ fontSize: 10, fill: "var(--text-muted)" }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(d) => new Date(d).toLocaleDateString('fr-FR', { month: 'short' })}
              />
              <YAxis 
                tick={{ fontSize: 10, fill: "var(--text-muted)" }} 
                axisLine={false} 
                tickLine={false}
                tickFormatter={(v) => `${(v/1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ backgroundColor: "var(--surface-1)", border: "1px solid var(--surface-3)", borderRadius: 12, fontSize: 12 }}
                itemStyle={{ color: "var(--brand-400)" }}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{ fill: "#6366f1", strokeWidth: 2, r: 4, stroke: "var(--surface-1)" }} 
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donut */}
      {donut.length > 0 && (
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-8">
          <div className="w-48 h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" cx="50%" cy="50%" innerRadius={55} outerRadius={80} strokeWidth={0}>
                  {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--surface-4)", borderRadius: 12, fontSize: 12, color: "var(--text-primary)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-sm font-semibold mb-3">Répartition des actifs</h3>
            {donut.map((d) => (
              <div key={d.name} className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-sm flex-1">{d.name}</span>
                <span className="text-sm font-mono font-bold">{formatCurrency(d.value)}</span>
                <span className="text-xs text-text-muted w-12 text-right">{totalAssets > 0 ? formatPercent((d.value / totalAssets) * 100) : "0%"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assets list */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-secondary">Actifs ({assets.length})</h2>
        <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setAssetOpen(true)}>Ajouter</Button>
      </div>
      <div className="space-y-2">
        {assets.map((a) => {
          const pv = a.purchase_price ? ((Number(a.current_value) - Number(a.purchase_price)) / Number(a.purchase_price)) * 100 : null;
          return (
            <div key={a.id} className="bg-surface-1 border border-surface-3 rounded-2xl p-4 flex items-center gap-4 group">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${COLORS[a.type]}20`, color: COLORS[a.type] }}>
                {ASSET_TYPES.find((t) => t.value === a.type)?.label.slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{a.name}</p>
                <p className="text-[11px] text-text-muted">{ASSET_TYPES.find((t) => t.value === a.type)?.label.slice(2)}</p>
              </div>
              <div className="text-right flex items-center gap-4">
                <div>
                  <p className="text-sm font-mono font-bold">{formatCurrency(Number(a.current_value))}</p>
                  {pv !== null && <p className={`text-[11px] font-mono ${pv >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{pv >= 0 ? "+" : ""}{pv.toFixed(1)}%</p>}
                </div>
                <button onClick={() => removeItem("assets", a.id)} className="p-2 text-text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Liabilities */}
      <div className="flex items-center justify-between mt-6">
        <h2 className="text-sm font-semibold text-text-secondary">Passifs ({liabilities.length})</h2>
        <Button size="sm" variant="secondary" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => setLiabOpen(true)}>Ajouter</Button>
      </div>
      <div className="space-y-2">
        {liabilities.map((l) => (
          <div key={l.id} className="bg-surface-1 border border-surface-3 rounded-2xl p-4 flex items-center gap-4 group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-rose-500/10 text-rose-400"><CreditCard className="w-5 h-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{l.name}</p>
              <p className="text-[11px] text-text-muted">{l.monthly_payment ? `${formatCurrency(Number(l.monthly_payment))}/mois` : ""} {l.interest_rate ? `· ${l.interest_rate}%` : ""}</p>
            </div>
            <div className="text-right flex items-center gap-4">
                <div>
                <p className="text-sm font-mono font-bold text-rose-400">{formatCurrency(Number(l.remaining_amount))}</p>
                <p className="text-[11px] text-text-muted">/{formatCurrency(Number(l.initial_amount || 0))}</p>
              </div>
              <button onClick={() => removeItem("liabilities", l.id)} className="p-2 text-text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Asset Modal */}
      <Modal isOpen={assetOpen} onClose={() => setAssetOpen(false)} title="Nouvel actif" size="sm">
        <div className="space-y-4">
          <Input label="Nom" value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Appartement, ETF World..." />
          <Select label="Type" options={ASSET_TYPES} value={aType} onChange={(e) => setAType(e.target.value)} />
          <Input label="Valeur actuelle" type="number" step="0.01" value={aValue} onChange={(e) => setAValue(e.target.value)} />
          <Input label="Prix d'achat (opt.)" type="number" step="0.01" value={aPurchase} onChange={(e) => setAPurchase(e.target.value)} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setAssetOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={addAsset}>Ajouter</Button>
          </div>
        </div>
      </Modal>

      {/* Add Liability Modal */}
      <Modal isOpen={liabOpen} onClose={() => setLiabOpen(false)} title="Nouveau passif" size="sm">
        <div className="space-y-4">
          <Input label="Nom" value={lName} onChange={(e) => setLName(e.target.value)} placeholder="Crédit appartement..." />
          <Select label="Type" options={LIABILITY_TYPES} value={lType} onChange={(e) => setLType(e.target.value)} />
          <Input label="Montant initial" type="number" step="0.01" value={lTotal} onChange={(e) => setLTotal(e.target.value)} />
          <Input label="Capital restant" type="number" step="0.01" value={lRemaining} onChange={(e) => setLRemaining(e.target.value)} />
          <Input label="Taux (%)" type="number" step="0.001" value={lRate} onChange={(e) => setLRate(e.target.value)} />
          <Input label="Mensualité" type="number" step="0.01" value={lMonthly} onChange={(e) => setLMonthly(e.target.value)} />
          <Select label="Compte de débit automatique" options={[{ value: "", label: "Aucun débit auto" }, ...accounts.map(a => ({ value: a.id, label: a.name }))]} value={lAccount} onChange={(e) => setLAccount(e.target.value)} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setLiabOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={addLiab}>Ajouter</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

