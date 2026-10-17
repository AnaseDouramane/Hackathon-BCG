// "Suspected" e confidenza (spec §6.7). Serve solo a dire a Felix quanto fidarsi:
// non entra nel calcolo di urgenza e priorità.
import type { AlertSource, Category } from "@/lib/contract/schemas";

export type ConfidenceInput = {
  category: Category;
  source: AlertSource;
  confidence: number | null;
};

/**
 * - DISEASE automatico → "Suspected · 78%"
 * - FERTILIZER / MATURITY automatico → "Estimate · 85%"
 * - MANUAL o senza confidenza → null (nessuna etichetta)
 */
export function getConfidenceLabel(alert: ConfidenceInput): string | null {
  if (alert.source === "MANUAL" || alert.confidence === null) return null;
  const pct = Math.round(alert.confidence * 100);
  const kind = alert.category === "DISEASE" ? "Suspected" : "Estimate";
  return `${kind} · ${pct}%`;
}

export const ADVICE_DISCLAIMER = "Simplified advice — to be validated by an agronomist";
