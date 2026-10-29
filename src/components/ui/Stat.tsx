import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";

interface StatProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Classes du pastille icône, ex. "bg-emerald-500/10 text-emerald-400" */
  accent: string;
  sub?: string;
  /** Valeur mise en avant (couleur du texte) */
  valueClass?: string;
  stagger?: number;
}

/** Carte statistique unifiée : label discret, valeur mono forte, sous-texte. */
export function Stat({ label, value, icon: Icon, accent, sub, valueClass, stagger }: StatProps) {
  return (
    <Card className="p-5 flex flex-col gap-2" stagger={stagger}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className={`text-2xl font-bold font-mono tracking-tight tabular-nums ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </Card>
  );
}
