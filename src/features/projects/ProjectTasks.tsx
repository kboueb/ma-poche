import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Trash2, Play, Square, Timer } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useTimeStore } from "@/stores/useTimeStore";
import { formatDuration, entryMinutes } from "@/lib/utils/time";
import { formatCurrency } from "@/lib/utils/currency";

interface Props {
  projectId: string;
  hourlyRate: number | null;
}

export default function ProjectTasks({ projectId, hourlyRate }: Props) {
  const { tasks, entries, loaded, fetch, addTask, updateTask, removeTask, activeEntry, startTimer, stopTimer } = useTimeStore();
  const [newTitle, setNewTitle] = useState("");
  const navigate = useNavigate();

  useEffect(() => { if (!loaded) fetch(); }, [loaded, fetch]);

  const projectTasks = tasks.filter((t) => t.project_id === projectId);
  const active = activeEntry();

  const minutesPerTask = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      if (!e.task_id) return;
      map.set(e.task_id, (map.get(e.task_id) || 0) + entryMinutes(e.started_at, e.ended_at, e.duration_minutes));
    });
    return map;
  }, [entries]);

  const totalMinutes = projectTasks.reduce((s, t) => s + (minutesPerTask.get(t.id) || 0), 0);

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    await addTask(projectId, newTitle.trim());
    setNewTitle("");
  };

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
        <Timer className="w-3.5 h-3.5" /> Tâches & temps
        {totalMinutes > 0 && (
          <span className="ml-auto font-mono normal-case">
            {formatDuration(totalMinutes)}
            {hourlyRate ? <span className="text-emerald-400"> · {formatCurrency((totalMinutes / 60) * hourlyRate)}</span> : null}
          </span>
        )}
      </h4>
      <div className="space-y-1.5">
        {projectTasks.length === 0 && (
          <p className="text-[11px] text-text-muted">Aucune tâche — ex : cadrage, dev, réunion, recette…</p>
        )}
        {projectTasks.map((t) => {
          const mins = minutesPerTask.get(t.id) || 0;
          const isRunning = active?.task_id === t.id;
          return (
            <div key={t.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs group ${isRunning ? "bg-brand-500/10 border border-brand-500/30" : "bg-surface-2"}`}>
              <button
                onClick={() => updateTask(t.id, { done: !t.done })}
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${t.done ? "bg-emerald-500 border-emerald-500 text-white" : "border-surface-4 hover:border-emerald-500"}`}
              >
                {t.done && <Check className="w-3 h-3" />}
              </button>
              <span className={`flex-1 truncate ${t.done ? "line-through text-text-muted" : ""}`}>{t.title}</span>
              {mins > 0 && <span className="font-mono text-text-muted shrink-0">{formatDuration(mins)}</span>}
              {isRunning ? (
                <button onClick={() => stopTimer()} className="p-1.5 rounded-lg bg-brand-500 text-white shrink-0" title="Stopper">
                  <Square className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={() => startTimer(t.id)}
                  disabled={t.done}
                  className="p-1.5 rounded-lg text-text-muted hover:text-brand-400 hover:bg-brand-500/10 shrink-0 disabled:opacity-30 transition-colors"
                  title="Démarrer le timer"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={() => removeTask(t.id)} className="p-1 text-text-muted hover:text-rose-400 opacity-0 group-hover:opacity-100 shrink-0" title="Supprimer">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Nouvelle tâche : livraison V1, réunion client..."
          className="flex-1 bg-surface-2 border border-surface-4 rounded-xl px-3 py-2 text-xs outline-none focus:border-brand-500"
        />
        <Button size="sm" onClick={handleAdd}>Ajouter</Button>
      </div>
      {projectTasks.length > 0 && (
        <button onClick={() => navigate("/temps")} className="text-[11px] text-brand-400 hover:underline mt-2">
          Voir le rapport de temps →
        </button>
      )}
    </div>
  );
}
