import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils/currency";
import { daysUntil, formatDate } from "@/lib/utils/dates";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Plus, Target, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import type { Goal } from "@/types";

function GoalStatus({ goal }: { goal: Goal }) {
  const pct = goal.target_amount > 0 ? (Number(goal.current_amount) / Number(goal.target_amount)) * 100 : 0;
  const days = goal.deadline ? daysUntil(goal.deadline) : null;
  const monthsLeft = days !== null ? Math.max(Math.ceil(days / 30), 1) : null;
  const monthlyNeeded = monthsLeft ? (Number(goal.target_amount) - Number(goal.current_amount)) / monthsLeft : null;

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
        {isReached ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        ) : isLate ? (
          <AlertCircle className="w-5 h-5 text-rose-400" />
        ) : null}
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
          <span className="font-mono font-bold">{formatCurrency(Number(goal.current_amount))}</span>
          <span className="text-text-muted font-mono">{formatCurrency(Number(goal.target_amount))}</span>
        </div>
        <p className="text-[11px] text-text-muted text-center">{pct.toFixed(0)}% atteint</p>
      </div>

      {/* Monthly recommendation */}
      {monthlyNeeded !== null && monthlyNeeded > 0 && !isReached && (
        <div className="bg-brand-500/5 border border-brand-500/10 rounded-xl px-3 py-2">
          <p className="text-[11px] text-brand-400 font-medium">
            💡 Épargnez <span className="font-mono font-bold">{formatCurrency(monthlyNeeded)}</span>/mois pour atteindre l'objectif
          </p>
        </div>
      )}
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [current, setCurrent] = useState("0");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadGoals(); }, []);

  const loadGoals = async () => {
    const { data } = await supabase.from("goals").select("*").order("created_at");
    setGoals((data as Goal[]) || []);
    setLoading(false);
  };

  const addGoal = async () => {
    if (!name || !target) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("goals").insert({
        user_id: user.id, name, target_amount: parseFloat(target),
        current_amount: parseFloat(current || "0"),
        deadline: deadline || null, icon: "target", color: "#10b981",
      });
      await loadGoals();
    }
    setSaving(false); setFormOpen(false);
    setName(""); setTarget(""); setCurrent("0"); setDeadline("");
  };

  const totalTarget = goals.reduce((s, g) => s + Number(g.target_amount), 0);
  const totalCurrent = goals.reduce((s, g) => s + Number(g.current_amount), 0);

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
          {goals.map((g) => <GoalStatus key={g.id} goal={g} />)}
        </div>
      )}

      {/* Add modal */}
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Nouvel objectif" size="sm">
        <div className="space-y-4">
          <Input label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Vacances, Apport immobilier..." />
          <Input label="Montant cible" type="number" step="0.01" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="10000" />
          <Input label="Montant actuel" type="number" step="0.01" value={current} onChange={(e) => setCurrent(e.target.value)} />
          <Input label="Date limite (optionnel)" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" className="flex-1" onClick={() => setFormOpen(false)}>Annuler</Button>
            <Button className="flex-1" loading={saving} onClick={addGoal}>Créer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
