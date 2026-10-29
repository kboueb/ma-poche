import { useEffect, useState } from "react";
import { Download, RefreshCw, X, CheckCircle2, TriangleAlert } from "lucide-react";
import { isTauriRuntime } from "@/lib/tauri";

type Status =
  | { phase: "idle" }
  | { phase: "available"; version: string; notes: string }
  | { phase: "downloading"; progress: number }
  | { phase: "installing" }
  | { phase: "done" }
  | { phase: "error"; message: string };

export default function UpdateBanner() {
  const [status, setStatus] = useState<Status>({ phase: "idle" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [updateObj, setUpdateObj] = useState<any>(null);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;
    (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!cancelled && update) {
          setUpdateObj(update);
          setStatus({ phase: "available", version: update.version, notes: update.body || "" });
        }
      } catch {
        // Pas réseau / pas de latest.json → silencieux
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const install = async () => {
    if (!updateObj) return;
    setStatus({ phase: "downloading", progress: 0 });
    try {
      let downloaded = 0;
      let total = 0;
      await updateObj.downloadAndInstall((event: { event: string; data: { chunkLength: number; contentLength?: number } }) => {
        if (event.event === "Started") {
          total = event.data.contentLength || 0;
        } else if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          if (total > 0) setStatus({ phase: "downloading", progress: Math.round((downloaded / total) * 100) });
        } else if (event.event === "Finished") {
          setStatus({ phase: "installing" });
        }
      });
      setStatus({ phase: "done" });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      setTimeout(() => relaunch(), 1200);
    } catch (e) {
      setStatus({ phase: "error", message: e instanceof Error ? e.message : "Échec de la mise à jour" });
    }
  };

  if (status.phase === "idle") return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-50 w-[320px] bg-surface-1 border border-brand-500/30 rounded-2xl p-4 shadow-xl shadow-black/30">
      {status.phase === "available" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2">
            <Download className="w-4 h-4 text-brand-400 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Mise à jour {status.version} disponible</p>
              {status.notes && <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">{status.notes}</p>}
            </div>
            <button onClick={() => setStatus({ phase: "idle" })} className="p-1 text-text-muted hover:text-text-primary">
              <X className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={install}
            className="w-full py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
          >
            Télécharger et installer
          </button>
        </div>
      )}

      {status.phase === "downloading" && (
        <div className="space-y-2">
          <p className="text-sm font-semibold flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-brand-400 animate-spin" />
            Téléchargement... {status.progress}%
          </p>
          <div className="h-2 bg-surface-3 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width: `${status.progress}%` }} />
          </div>
        </div>
      )}

      {status.phase === "installing" && (
        <p className="text-sm font-semibold flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-brand-400 animate-spin" /> Installation...
        </p>
      )}

      {status.phase === "done" && (
        <p className="text-sm font-semibold flex items-center gap-2 text-emerald-400">
          <CheckCircle2 className="w-4 h-4" /> Redémarrage...
        </p>
      )}

      {status.phase === "error" && (
        <div className="space-y-2">
          <p className="text-sm text-rose-400 flex items-center gap-1.5"><TriangleAlert className="w-4 h-4 shrink-0" /> {status.message}</p>
          <button onClick={() => setStatus({ phase: "idle" })} className="text-xs text-text-muted hover:text-text-primary">
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
