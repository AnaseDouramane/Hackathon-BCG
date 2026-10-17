// Urgenza (spec §6.2): calcolata, mai salvata.
import type { AlertLike } from "./types";

export const URGENT_WINDOW_HOURS = 72;
const URGENT_WINDOW_MS = URGENT_WINDOW_HOURS * 60 * 60 * 1000;

export function isWithinUrgentWindow(date: Date, now: Date): boolean {
  return date.getTime() - now.getTime() <= URGENT_WINDOW_MS;
}

/** Aperto e (CRITICAL oppure scadenza entro 72 h da "adesso"). */
export function isUrgent(alert: AlertLike, now: Date): boolean {
  if (alert.status !== "OPEN") return false;
  if (alert.severity === "CRITICAL") return true;
  if (!alert.dueAt) return false;
  return isWithinUrgentWindow(alert.dueAt, now);
}

/** Un'azione è urgente se il suo alert lo è e la sua scadenza (se c'è) cade entro 72 h. */
export function isActionUrgent(alert: AlertLike, actionDueAt: Date | null, now: Date): boolean {
  return isUrgent(alert, now) && (actionDueAt === null || isWithinUrgentWindow(actionDueAt, now));
}

export function openAlerts<T extends AlertLike>(alerts: T[]): T[] {
  return alerts.filter((a) => a.status === "OPEN");
}
