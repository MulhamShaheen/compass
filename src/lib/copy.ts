/** Shared UI copy that both server actions and components need. */
export const NORTH_PLACEHOLDER = "I'll write this when I know";

export const TIME_OPTIONS: [minutes: number, label: string][] = [
  [0, "Just a note"],
  [15, "15 min"],
  [30, "30 min"],
  [45, "45 min"],
  [60, "1 hour"],
  [90, "1.5 hours"],
  [120, "2 hours"],
  [180, "3 hours"],
  [240, "Half a day"],
  [480, "Full day"],
];

/** "45m", "1h", "1.5h". */
export function formatMinutes(m: number): string {
  if (m < 60) return `${Math.round(m)}m`;
  return `${(m / 60).toFixed(m % 60 ? 1 : 0).replace(/\.0$/, "")}h`;
}
