import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils/currency";
import { daysUntil, formatDate } from "@/lib/utils/dates";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Plus, Target, Clock, CheckCircle2, AlertCircle, PiggyBank, ArrowRightLeft, Building2, Edit2 } from "lucide-react";
import type { Goal } from "@/types";
import { useAccountsStore } from "@/stores/useAccountsStore";
import { useTransactionsStore } from "@/stores/useTransactionsStore";

function GoalStatus({ goal, onContribute, onConvert, onEdit, accountBalance }: { goal: Goal, onContribute: (goal: Goal) => void, onConvert: (goal: Goal) => void, onEdit: (goal: Goal) => void, accountBalance?: number }) {
  const currentAmount = goal.linked_account_id && accountBalance !== undefined ? accountBalance : Number(goal.current_amount);
  const pct = goal.target_amount > 0 ? (currentAmount / Number(goal.target_amount)) * 100 : 0;
  const days = goal.deadline ? daysUntil(goal.deadline) : null;
  const monthsLeft = days !== null ? Math.max(Math.ceil(days / 30), 1) : null;
  const monthlyNeeded = monthsLeft ? (Number(goal.target_amount) - currentAmount) / monthsLeft : null;

  const isReached = pct >= 100;
  const isLate = days !== null && days < 0 && !isReached;

  return (
    <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: `${goal.color}20`, color: goal.color }}>
            {goal.icon === "target" ? "🎯" : goal.icon}
          </div>
          <div>
            <h3 className="text-sm font-bold">{goal.name}</h3>
            {goal.deadline && (
              <p className="text-[11px] text-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {isLate ? "En retard" : `${days}j restants`} — {formatDate(goal.deadline, "d MMM yyyy")}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onEdit(goal)} className="p-1.5 text-text-muted hover:text-brand-400 hover:bg-surface-2 rounded-lg transition-colors">
            <Edit2 className="w-4 h-4" />
          </button>
          {isReached ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 mt-1" />
          ) : isLate ? (
            <AlertCircle className="w-5 h-5 text-rose-400 mt-1" />
          ) : null}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-3 bg-surface-3 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: isReached ? "#10b981" : goal.color }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className="font-mono font-bold">{formatCurrency(currentAmount)}</span>
          <span className="text-text-muted font-mono">{formatCurrency(Number(goal.target_amount))}</span>
        </div>
        <p className="text-[11px] text-text-muted text-center">{pct.toFixed(0)}% atteint</p>
      </div>

      {/* Monthly recommendation & Action */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {monthlyNeeded !== null && monthlyNeeded > 0 && !isReached ? (
          <div className="bg-brand-500/5 border border-brand-500/10 rounded-xl px-3 py-2 flex-1">
            <p className="text-[11px] text-brand-400 font-medium">
              💡 Épargnez <span className="font-mono font-bold">{formatCurrency(monthlyNeeded)}</span>/mois
            </p>
          </div>
        ) : (
          <div className="flex-1" />
        )}
        {isReached ? (
          <Button 
            className="h-9 px-4 rounded-xl gap-2 bg-emerald-500 hover:bg-emerald-600 text-white"
            onClick={() => onConvert(goal)}
          >
            <Building2 className="w-4 h-4" />
            Convertir en Actif
          </Button>
        ) : !goal.linked_account_id ? (
          <Button 
            variant="secondary" 
            size="sm" 
            className="h-9 px-4 rounded-xl gap-2"
            onClick={() => onContribute(goal)}
          >
            <PiggyBank className="w-4 h-4" />
            Verser
          </Button>
        ) : (
          <p className="text-xs text-text-muted flex items-center gap-1"><ArrowRightLeft className="w-3 h-3"/> Automatique</p>
        )}
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const { accounts, fetch: fetchAcc } = useAccountsStore();
  const { transactions, fetch: fetchTx } = useTransactionsStore();
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [linkedAccountId, setLinkedAccountId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  
  // Contribution modal
  const [contributionOpen, setContributionOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const [contributing, setContributing] = useState(false);

  // Convert modal
  const [convertOpen, setConvertOpen] = useState(false);
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState("real_estate");
  const [converting, setConverting] = useState(false);

  useEffect(() => { loadGoals(); fetchAcc(); fetchTx(); }, [fetchAcc, fetchTx]);

  const getAccountBalance = (accountId: string) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return 0;
    const accTx = transactions.filter(t => t.account_id === accountId);
    const inc = accTx.filter(t => t.flow === "income").reduce((s, t) => s + Number(t.amount), 0);
    const exp = accTx.filter(t => t.flow === "expense").reduce((s, t) => s + Number(t.amount), 0);
    return Number(acc.initial_balance || 0) + inc - exp;
  };

  const loadGoals = async () => {
    const { data } = await supabase.from("goals").select("*").order("created_at");
    setGoals((data as Goal[]) || []);
    setLoading(false);
  };

  const saveGoal = async () => {
    if (!name || !target) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const payload = {
        name, 
        target_amount: parseFloat(target),
        current_amount: linkedAccountId ? 0 : parseFloat(current || "0"),
        deadline: deadline || null, 
        linked_account_id: linkedAccountId || null,
        icon: "target", 
        color: "#10b981",
      };

      if (editingGoal) {
        await supabase.from("goals").update(payload).eq("id", editingGoal.id);
      } else {
        await supabase.from("goals").insert({ ...payload, user_id: user.id });
      }
      await loadGoals();
    }
    closeForm();
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTarget(goal.target_amount.toString());
    setCurrent(goal.current_amount.toString());
    setDeadline(goal.deadline || "");
    setLinkedAccountId(goal.linked_account_id || "");
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingGoal(null);
    setName(""); setTarget(""); setCurrent("0"); setDeadline(""); setLinkedAccountId("");
    setSaving(false);
  };

  const handleContribute = async () => {
    if (!selectedGoal || !contributionAmount) return;
    setContributing(true);
    
    const newAmount = Number(selectedGoal.current_amount) + parseFloat(contributionAmount);
    
    const { error } = await supabase
      .from("goals")
      .update({ current_amount: newAmount })
      .eq("id", selectedGoal.id);

    if (!error) {
      await loadGoals();
      setContributionOpen(false);
      setContributionAmount("");
    }
    setContributing(false);
  };

  const openContribution = (goal: Goal) => {
    setSelectedGoal(goal);
    setContributionOpen(true);
  };

  const openConvert = (goal: Goal) => {
    setSelectedGoal(goal);
    setAssetName(goal.name);
    setConvertOpen(true);
  };

  const handleConvert = async () => {
    if (!selectedGoal || !assetName) return;
    setConverting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Create asset
      await supabase.from("assets").insert({
        user_id: user.id,
        name: assetName,
        type: assetType,
        current_value: selectedGoal.target_amount,
        purchase_price: selectedGoal.target_amount,
        purchase_date: new Date().toISOString().split('T')[0]
      });

      // Optionally, we could create an expense if it was linked to an account to empty it,
      // but let's keep it simple: just delete the goal since it's achieved and converted
      await supabase.from("goals").delete().eq("id", selectedGoal.id);

      await loadGoals();
      setConvertOpen(false);
    }
    setConverting(false);
  };

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalCurrent = goals.reduce((s, g) => s + (g.linked_account_id ? getAccountBalance(g.linked_account_id) : Number(g.current_amount)), 0);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Objectifs</h1>
          <p className="text-text-muted text-sm mt-1">{goals.length} objectif{goals.length > 1 ? "s" : ""}</p>
        </div>
        <Button icon={<Plus className="w-4 h-4" />} onClick={() => setFormOpen(true)}>Nouvel objectif</Button>
      </div>

      {/* Total progress */}
      {goals.length > 0 && (
        <div className="bg-surface-1 border border-surface-3 rounded-2xl p-5">
          <p className="text-xs text-text-muted uppercase tracking-wider mb-2">Progression globale</p>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-700" style={{ width: `${totalTarget > 0 ? (totalCurrent / totalTarget) * 100 : 0}%` }} />
              </div>
            </div>
            <p className="text-sm font-mono font-bold text-emerald-400 shrink-0">
              {formatCurrency(totalCurrent)} <span className="text-text-muted font-normal">/ {formatCurrency(totalTarget)}</span>
            </p>
          </div>
        </div>
      )}

      {/* Goals grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-48 bg-surface-1 rounded-2xl animate-pulse" />)}
        </div>
      ) : goals.length === 0 ? (
        <div className="text-center py-20 text-text-muted">
          <Target className="w-12 h-12 mx-auto mb-3 text-text-muted opacity-40" />
          <p>Aucun objectif pour le moment</p>
          <Button variant="secondary" className="mt-4" onClick={() => setFormOpen(true)} icon={<Plus className="w-4 h-4" />}>Créer mon premier objectif</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {goals.map((g) => (
            <GoalStatus 
              key={g.id} 
              goal={g} 
              onContribute={openContribution} 
              onConvert={openConvert}
              onEdit={openEdit}
              accountBalance={g.linked_account_id ? getAccountBalance(g.linked_account_id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal isOpen={formOpen} onClose={closeForm} title={editingGoal ? "Modifier l'objectif" : "Nouvel objectif"} size="sm">
        <div className="space-y-4">
          <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vacances, Apport immobilier..." />
          <Input label="Montant cible" type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000" />
          
          <Select 
            label="Lier à un compte (Optionnel)" 
            options={[{ value: "", label: "Aucun (mise à jour manuelle)" }, ...accounts.map(a => ({ value: a.id, label: a.name }))]}
            value={linkedAccountId}
            onChange={(e) => setLinkedAccountId(e.target.value)}
          />

          {!linkedAccountId && (
            <Input label="Montant actuel de départ" type="number" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value)} />
          )}

          <Input label="Date limite (optionnel)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={closeForm}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={saveGoal}>{editingGoal ? "Enregistrer" : "Créer"}</Button>
          </div>
        </div>
      </Modal>

      {/* Contribution modal */}
      <Modal 
        isOpen={contributionOpen} 
        onClose={() => setContributionOpen(false)} 
        title={`Verser pour "${selectedGoal?.name}"`}
        size="sm"
      >
        <div className="space-y-4">
          <div className="bg-surface-2 p-4 rounded-2xl flex justify-between items-center">
            <span className="text-sm text-text-muted">Actuellement</span>
            <span className="font-mono font-bold text-lg">{formatCurrency(Number(selectedGoal?.current_amount || 0))}</span>
          </div>
          
          <Input 
            label="Montant à ajouter" 
            type="number" 
            step="0.01" 
            value={contributionAmount} 
            onChange={(e) => setContributionAmount(e.target.value)} 
            placeholder="Ex: 5000"
            autoFocus
          />
          
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setContributionOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={contributing} onClick={handleContribute} icon={<PiggyBank className="w-4 h-4" />}>
              Confirmer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Convert to Asset Modal */}
      <Modal 
        isOpen={convertOpen} 
        onClose={() => setConvertOpen(false)} 
        title="Convertir en Actif Patrimonial"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-muted">Félicitations pour cet objectif atteint ! Vous pouvez maintenant le transformer en actif dans votre patrimoine.</p>
          
          <Input 
            label="Nom de l'actif" 
            value={assetName} 
            onChange={(e) => setAssetName(e.target.value)} 
          />
          
          <Select
            label="Type d'actif"
            options={[
              { value: "real_estate", label: "🏡 Immobilier" },
              { value: "vehicle", label: "🚗 Véhicule" },
              { value: "stock", label: "📈 Actions / Bourse" },
              { value: "savings_account", label: "🏦 Compte bloqué" },
              { value: "other", label: "📦 Autre" },
            ]}
            value={assetType}
            onChange={(e) => setAssetType(e.target.value)}
          />
          
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setConvertOpen(false)}>Annuler</Button>
            <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600" loading={converting} onClick={handleConvert} icon={<Building2 className="w-4 h-4" />}>
              Créer l'actif
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
