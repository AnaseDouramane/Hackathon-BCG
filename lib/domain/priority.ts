// Priorità (spec §6.4).
import type { Category, Severity } from "@/lib/contract/schemas";
import type { AlertLike } from "./types";
import { isUrgent } from "./urgency";

const SEVERITY_WEIGHT: Record<Severity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Le malattie si diffondono e il raccolto ha finestre rigide: vengono prima. */
const CATEGORY_WEIGHT: Record<Category, number> = { DISEASE: 3, MATURITY: 2, FERTILIZER: 1 };

/** Negativo se `a` è più prioritario di `b`. */
export function compareAlerts(a: AlertLike, b: AlertLike, now: Date): number {
  const urgent = Number(isUrgent(b, now)) - Number(isUrgent(a, now));
  if (urgent !== 0) return urgent;

  const severity = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
  if (severity !== 0) return severity;

  const due = (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity);
  if (due !== 0 && !Number.isNaN(due)) return due;

  const category = CATEGORY_WEIGHT[b.category] - CATEGORY_WEIGHT[a.category];
  if (category !== 0) return category;

  return a.id.localeCompare(b.id);
}

export function sortAlerts<T extends AlertLike>(alerts: T[], now: Date): T[] {
  return [...alerts].sort((a, b) => compareAlerts(a, b, now));
}

/**
 * Ordina gli elementi in base al loro alert più prioritario.
 * Gli elementi senza alert vanno in fondo, in ordine di `tieBreak`.
 */
export function sortByTopAlert<T>(
  items: T[],
  getTopAlert: (item: T) => AlertLike | null,
  tieBreak: (item: T) => string,
  now: Date,
): T[] {
  return [...items].sort((x, y) => {
    const a = getTopAlert(x);
    const b = getTopAlert(y);
    if (a && b) return compareAlerts(a, b, now) || tieBreak(x).localeCompare(tieBreak(y));
    if (a) return -1;
    if (b) return 1;
    return tieBreak(x).localeCompare(tieBreak(y));
  });
}

/** Prima le azioni non fatte, poi per `priority` crescente (1 = la più importante). */
export function sortActions<T extends { done: boolean; priority: number }>(actions: T[]): T[] {
  return [...actions].sort((a, b) => Number(a.done) - Number(b.done) || a.priority - b.priority);
}
