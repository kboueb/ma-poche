import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Square } from "lucide-react";
import { useTimeStore } from "@/stores/useTimeStore";

/** Mini-widget persistant affiché tant qu'un timer tourne. */
export default function TimerWidget() {
  const { entries, loaded, fetch, stopTimer } = useTimeStore();
  const [now, setNow] = useState(Date.now());
  const navigate = useNavigate();

  useEffect(() => { if (!loaded) fetch(); }, [loaded, fetch]);

  const active = entries.find((e) => !e.ended_at) || null;

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null;

  const secs = Math.max(Math.floor((now - new Date(active.started_at).getTime()) / 1000), 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  const str = `${pad(Math.floor(secs / 3600))}:${pad(Math.floor((secs % 3600) / 60))}:${pad(secs % 60)}`;

  return (
    <div className="fixed left-4 bottom-20 md:bottom-6 z-40 flex items-center gap-2.5 bg-surface-1 border border-brand-500/40 rounded-2xl pl-3 pr-2 py-2 shadow-xl shadow-black/30 max-w-[calc(100vw-2rem)]">
      <button onClick={() => navigate("/temps")} className="flex items-center gap-2 min-w-0 text-left" title="Voir la page Temps">
        <span className="relative flex w-2.5 h-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-500" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-bold truncate max-w-[140px]">{active.task?.title || "Timer en cours"}</span>
          <span className="block text-[11px] font-mono tabular-nums text-brand-400">{str}</span>
        </span>
      </button>
      <button
        onClick={() => stopTimer()}
        className="p-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white transition-colors shrink-0"
        title="Stopper le timer"
      >
        <Square className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
