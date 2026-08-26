import { useEffect, useState } from "react";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Plus, Wallet, Landmark, CreditCard, Trash2, Edit2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { toast } from "sonner";
import type { Account } from "@/types";

const ACCOUNT_TYPES = [
  { value: "checking", label: "🏦 Compte Courant" },
  { value: "savings", label: "💰 Épargne / Livret" },
  { value: "mobile_money", label: "📱 Mobile Money (Wave, Orange...)" },
  { value: "cash", label: "💵 Espèces / Cash" },
  { value: "investment", label: "📈 Investissement" },
];

export default function AccountsPage() {
  const { accounts, loading, fetch, add, update, remove } = useAccountsStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editingAcc, setEditingAcc] = useState<Account | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [institution, setInstitution] = useState("");
  const [balance, setBalance] = useState("0");
  const [color, setColor] = useState("#10b981");
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => {
    setName(""); setType("checking"); setInstitution(""); setBalance("0"); setColor("#10b981");
  };

  const handleAdd = async () => {
    if (!name) return;
    setSaving(true);
    await add({
      name,
      type: type as Account["type"],
      institution,
      initial_balance: parseFloat(balance),
      current_balance: parseFloat(balance),
      currency: "XOF",
      color,
    });
    setSaving(false);
    setFormOpen(false);
    resetForm();
  };

  const handleEdit = async () => {
    if (!name || !editingAcc) return;
    setSaving(true);
    await update(editingAcc.id, {
      name,
      type: type as Account["type"],
      institution,
      color,
    });
    setSaving(false);
    setFormOpen(false);
    setEditingAcc(null);
    resetForm();
    toast.success("Compte mis à jour");
  };

  const openEdit = (acc: Account) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setInstitution(acc.institution || "");
    setColor(acc.color);
    setFormOpen(true);
  };

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mes Comptes</h1>
          <p className="text-text-muted text-sm mt-1">{accounts.length} compte{accounts.length > 1 ? "s" : ""} actif(s)</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Nouveau compte</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {accounts.map((acc) => (
          <div key={acc.id} className="bg-surface-1 border border-surface-3 rounded-2xl p-5 flex flex-col justify-between group relative overflow-hidden">
            {/* Background accent */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] -mr-8 -mt-8 rotate-12">
              <Landmark className="w-full h-full" />
            </div>

            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${acc.color}20`, color: acc.color }}>
                  {acc.type === "mobile_money" ? <CreditCard className="w-5 h-5" /> : <Landmark className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-text-primary">{acc.name}</h3>
                  <p className="text-[11px] text-text-muted uppercase tracking-wider">{acc.institution || "Banque"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(acc)} className="p-2 text-text-muted hover:text-brand-400 opacity-0 group-hover:opacity-100 transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => { remove(acc.id); toast.success("Compte supprimé"); }}
                  className="p-2 text-text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-8 relative z-10">
              <p className="text-2xl font-mono font-bold">{formatCurrency(Number(acc.current_balance || 0))}</p>
              <p className="text-[10px] text-text-muted mt-1 uppercase tracking-widest">Solde actuel</p>
            </div>
          </div>
        ))}

        {accounts.length === 0 && !loading && (
          <div className="sm:col-span-2 text-center py-20 bg-surface-1 border-2 border-dashed border-surface-3 rounded-3xl">
            <Wallet className="w-12 h-12 text-surface-3 mx-auto mb-4" />
            <p className="text-text-muted">Aucun compte configuré</p>
            <Button variant="secondary" className="mt-4" onClick={() => setFormOpen(true)}>Créer mon premier compte</Button>
          </div>
        )}
      </div>

      <Modal isOpen={formOpen} onClose={() => { setFormOpen(false); setEditingAcc(null); }} title={editingAcc ? "Modifier le compte" : "Nouveau compte bancaire"} size="sm">
        <div className="space-y-4">
          <Input label="Nom du compte" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Compte Courant, Wave..." />
          <Select label="Type de compte" options={ACCOUNT_TYPES} value={type} onChange={(e) => setType(e.target.value)} />
          <Input label="Établissement" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Ex: Société Générale, Orange..." />
          <Input label="Solde initial" type="number" step="1" value={balance} onChange={(e) => setBalance(e.target.value)} />
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">Couleur</label>
            <div className="flex gap-2">
              {["#10b981", "#3b82f6", "#6366f1", "#f59e0b", "#f43f5e", "#94a3b8"].map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition-all ${color === c ? "ring-2 ring-offset-2 ring-offset-surface-1 ring-brand-500 scale-110" : "hover:scale-110"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => { setFormOpen(false); setEditingAcc(null); }}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={editingAcc ? handleEdit : handleAdd}>{editingAcc ? "Mettre à jour" : "Créer"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
