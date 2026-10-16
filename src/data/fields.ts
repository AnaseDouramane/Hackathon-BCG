/**
 * Data access layer. All UI reads go through these functions, so the seed
 * import can later be swapped for API calls without touching components.
 */
import { FIELDS } from "./seed";
import type { Alert, Category, Field, Severity } from "./types";

export const SEVERITY_RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 };

export const openAlerts = (f: Field) => f.alerts.filter((a) => a.status === "open");

/** Rule: an open critical alert, or an open alert due within 72 hours, is urgent. */
export const isAlertUrgent = (a: Alert) =>
  a.status === "open" && (a.severity === "critical" || a.dueInHours <= 72);

export const isFieldUrgent = (f: Field) => openAlerts(f).some(isAlertUrgent);

/** Most important open alert: urgent first, then severity, then nearest deadline. */
export function primaryAlert(f: Field): Alert | null {
  const list = [...openAlerts(f)].sort(compareAlerts);
  return list[0] ?? null;
}

function compareAlerts(a: Alert, b: Alert) {
  return (
    Number(isAlertUrgent(b)) - Number(isAlertUrgent(a)) ||
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    a.dueInHours - b.dueInHours
  );
}

/** Status colour shown on map, lists and lamp. */
export function fieldStatus(f: Field): Category {
  if (isFieldUrgent(f)) return "urgent";
  return primaryAlert(f)?.category ?? "healthy";
}

export function fieldMatches(f: Field, c: Category): boolean {
  if (c === "urgent") return isFieldUrgent(f);
  if (c === "healthy") return openAlerts(f).length === 0;
  return openAlerts(f).some((a) => a.category === c);
}

export function compareFields(a: Field, b: Field) {
  const pa = primaryAlert(a), pb = primaryAlert(b);
  if (!pa || !pb) return Number(!!pb) - Number(!!pa);
  return compareAlerts(pa, pb);
}

export const getFields = (): Field[] => [...FIELDS].sort(compareFields);
export const getField = (id: string) => FIELDS.find((f) => f.id === id) ?? null;
export const getFieldsByCategory = (c: Category) => getFields().filter((f) => fieldMatches(f, c));
export const countByCategory = (c: Category) => FIELDS.filter((f) => fieldMatches(f, c)).length;
export const getPriorities = (n = 5) => getFields().filter((f) => openAlerts(f).length).slice(0, n);

export const CATEGORIES: Category[] = ["urgent", "disease", "fertilizer", "maturity", "healthy"];
export const isCategory = (s: string): s is Category => (CATEGORIES as string[]).includes(s);

export function formatDue(hours: number) {
  if (hours <= 24) return "Due within 24 h";
  if (hours <= 72) return `Due in ${Math.round(hours / 24)} days`;
  return `Due in ${Math.round(hours / 24)} days`;
}
