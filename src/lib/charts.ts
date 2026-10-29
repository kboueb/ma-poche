import { formatCompact, formatCurrency } from "./utils/currency";

/** Thème graphique unique maPoche — à utiliser dans tous les graphiques recharts. */

// Palette catégorielle (camemberts, barres par catégorie)
export const CHART_COLORS = [
  "#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6",
  "#3b82f6", "#06b6d4", "#ec4899", "#94a3b8",
];

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

// Couleurs sémantiques
export const CHART_SERIES = {
  income: "#34d399",
  expense: "#fb7185",
  net: "#6366f1",
  primary: "#6366f1",
  secondary: "#94a3b8",
  snowball: "#38bdf8",
  avalanche: "#f43f5e",
} as const;

// Grille cartésienne discrète
export const chartGridProps = {
  strokeDasharray: "3 3",
  stroke: "var(--surface-3)",
  vertical: false,
} as const;

// Ticks d'axes (12px = taille standard, 11px = compact)
export const axisTick = { fontSize: 12, fill: "var(--text-muted)" } as const;
export const axisTickSmall = { fontSize: 11, fill: "var(--text-muted)" } as const;

export const axisLineProps = { axisLine: false, tickLine: false } as const;

// Formatters d'axe Y monétaire
export const compactTick = (v: number | string): string => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return formatCompact(n);
};

// Tooltip unifié (thème clair/sombre via variables CSS)
export const tooltipStyle = {
  backgroundColor: "var(--surface-1)",
  border: "1px solid var(--surface-3)",
  borderRadius: 12,
  fontSize: 12,
  color: "var(--text-primary)",
} as const;

export const tooltipLabelStyle = {
  color: "var(--text-muted)",
  fontWeight: "bold",
  marginBottom: 4,
} as const;

export const currencyTooltip = (v: number | string | Array<number | string>): string => {
  const n = Array.isArray(v) ? Number(v[0]) : Number(v);
  return formatCurrency(isNaN(n) ? 0 : n);
};

export const legendStyle = { fontSize: 11 } as const;
