import { Modal } from "@/components/ui/Modal";
import { useUIStore } from "@/stores/useUIStore";
import { Command, CornerDownLeft, Plus, Search, X } from "lucide-react";

export default function ShortcutsHelp() {
  const open = useUIStore((s) => s.shortcutsOpen);
  const setOpen = useUIStore((s) => s.setShortcutsOpen);
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? "⌘" : "Ctrl";

  const shortcuts: Array<{ keys: string[]; label: string; icon?: typeof Plus }> = [
    { keys: [mod, "K"], label: "Ouvrir la recherche globale", icon: Search },
    { keys: ["N"], label: "Nouvelle transaction", icon: Plus },
    { keys: ["↑", "↓"], label: "Naviguer dans les résultats", icon: Command },
    { keys: ["↵"], label: "Valider la sélection", icon: CornerDownLeft },
    { keys: ["esc"], label: "Fermer", icon: X },
    { keys: ["?"], label: "Afficher cette aide", icon: Command },
  ];

  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Raccourcis clavier" size="sm">
      <div className="space-y-1">
        {shortcuts.map(({ keys, label, icon: Icon }) => (
          <div key={label} className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-surface-2 transition-colors">
            {Icon && <Icon className="w-4 h-4 text-brand-400 shrink-0" />}
            <span className="flex-1 text-sm">{label}</span>
            <span className="flex gap-1">
              {keys.map((k) => (
                <kbd key={k} className="text-[11px] font-mono text-text-secondary bg-surface-3 border border-surface-4 rounded-md px-1.5 py-0.5 min-w-[24px] text-center">
                  {k}
                </kbd>
              ))}
            </span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
