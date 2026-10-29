/** 90 → "1h 30m", 45 → "45m", 0 → "0m" */
export function formatDuration(totalMinutes: number): string {
  const m = Math.max(Math.round(totalMinutes), 0);
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${rest}m`;
  if (rest === 0) return `${h}h`;
  return `${h}h ${rest}m`;
}

/** 90 → "1,50 h" (pour facturation). */
export function formatDecimalHours(totalMinutes: number): string {
  return `${(totalMinutes / 60).toFixed(2).replace(".", ",")} h`;
}

/** "1:30" ou "2h" → minutes. Retourne null si illisible. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(",", ".");
  if (!s) return null;
  // "1:30"
  const hm = s.match(/^(\d+):(\d{1,2})$/);
  if (hm) return parseInt(hm[1], 10) * 60 + parseInt(hm[2], 10);
  // "1.5h" / "1.5"
  const hOnly = s.match(/^(\d+(?:\.\d+)?)\s*h?$/);
  if (hOnly) {
    const v = parseFloat(hOnly[1]);
    // "90" seul = 90 minutes si >= 10 ? Ambigu : on considère les heures décimales si < 10 ? Non :
    // règle simple : sans unité, c'est des minutes si entier, des heures si décimal avec h
    if (s.includes("h")) return Math.round(v * 60);
    if (Number.isInteger(v)) return v; // minutes
    return Math.round(v * 60); // décimal → heures
  }
  // "1h30" / "1h 30" (minutes collées sans suffixe m)
  const hmGlued = s.match(/^(\d+(?:\.\d+)?)\s*h\s*(\d{1,2})$/);
  if (hmGlued) return Math.round(parseFloat(hmGlued[1]) * 60) + parseInt(hmGlued[2], 10);
  // "1h30" / "1h 30m" / "45m"
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/);
  const m = s.match(/(\d+)\s*m/);
  if (h || m) {
    return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? parseInt(m[1], 10) : 0));
  }
  return null;
}

/** Durée d'une entrée (terminée ou en cours) en minutes. */
export function entryMinutes(startedAt: string, endedAt: string | null, fallback: number | null): number {
  if (endedAt) {
    return Math.max(Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000), 0);
  }
  if (fallback != null) return fallback;
  return Math.max(Math.round((Date.now() - new Date(startedAt).getTime()) / 60000), 0);
}
