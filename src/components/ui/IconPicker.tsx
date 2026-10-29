import { ICON_CHOICES } from "./AppIcon";

interface IconPickerProps {
  value: string;
  onChange: (name: string) => void;
  color?: string;
}

/** Grille de choix d'icônes Lucide — remplace toute saisie d'emoji. */
export default function IconPicker({ value, onChange, color }: IconPickerProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
        Icône
      </label>
      <div className="grid grid-cols-8 gap-1.5 max-h-40 overflow-y-auto p-1 bg-surface-2 border border-surface-4 rounded-xl">
        {ICON_CHOICES.map(({ name, label, Icon }) => {
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              title={label}
              onClick={() => onChange(name)}
              className={`aspect-square rounded-lg flex items-center justify-center transition-all ${
                selected
                  ? "bg-brand-500/15 text-brand-400 ring-2 ring-brand-500"
                  : "text-text-muted hover:bg-surface-3 hover:text-text-primary"
              }`}
              style={selected && color ? { color } : undefined}
            >
              <Icon className="w-[18px] h-[18px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
