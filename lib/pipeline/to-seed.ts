// Trasforma i risultati di Claude (formato risk.py) nelle tabelle del seed: alert e azioni.
// Così repository, servizi, regole di colore/urgenza e tutta la UI restano invariati.
import type { Category, Severity } from "@/lib/contract/schemas";
import type { SeedAction, SeedAlert, SeedWeatherForecast } from "@/lib/contract/seed-schema";
import type { RiskAlert, RiskResult } from "@/lib/external/risk";
import type { DailyForecast } from "@/lib/external/weather";
import type { FieldAggregate } from "@/lib/domain/types";

const DAY_MS = 86_400_000;

const CATEGORY: Partial<Record<RiskAlert["type"], Category>> = {
  Disease: "DISEASE",
  Fertilizer: "FERTILIZER",
  Maturity: "MATURITY",
};

const SEVERITY: Record<RiskAlert["severity"], Severity> = {
  low: "LOW",
  moderate: "MEDIUM",
  high: "HIGH",
  critical: "CRITICAL",
};

const SEVERITY_RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

/**
 * Scadenza dell'alert in base alla gravità: CRITICAL (il flag Urgent di risk.py) cade entro le 72 h
 * e rende il campo rosso. Un alert che conferma una segnalazione ne tiene la scadenza, se più vicina.
 */
const DUE_DAYS: Record<Severity, number> = { CRITICAL: 1, HIGH: 4, MEDIUM: 7, LOW: 14 };

const addDays = (now: Date, days: number) => new Date(now.getTime() + days * DAY_MS);

/** Alert e azioni di un campo a partire dal risultato di Claude. */
export function alertsFromRisk(result: RiskResult, base: FieldAggregate, now: Date): { alerts: SeedAlert[]; actions: SeedAction[] } {
  const fieldId = base.field.id;
  const byCategory = new Map<Category, RiskAlert>();
  for (const a of result.alerts) {
    const category = CATEGORY[a.type];
    if (category && !byCategory.has(category)) byCategory.set(category, a);
  }

  const alerts: (SeedAlert & { riskActions: RiskAlert["actions"] })[] = [...byCategory].map(([category, a]) => {
    const severity = SEVERITY[a.severity];
    const previous = base.alerts.find((b) => b.category === category && b.status === "OPEN");
    // se Claude conferma la segnalazione (gravità non più bassa), si tiene la sua scadenza se è più vicina
    const due = addDays(now, DUE_DAYS[severity]);
    const keepDue = previous?.dueAt && SEVERITY_RANK[severity] >= SEVERITY_RANK[previous.severity] && previous.dueAt < due;
    return {
      id: `alr_${fieldId}_${category.toLowerCase()}`,
      fieldId,
      plantingId: base.planting?.id ?? null,
      category,
      severity,
      title: a.title,
      description: a.rationale ? `${a.evidence} ${a.rationale}` : a.evidence,
      source: a.source,
      confidence: Math.round(a.confidence * 100) / 100,
      detectedAt: previous?.detectedAt ?? now,
      dueAt: keepDue ? previous.dueAt : due,
      status: "OPEN",
      resolvedAt: null,
      riskActions: a.actions,
    };
  });

  // Urgent senza un alert critico: diventa critico il problema più grave del campo.
  if (result.flags.includes("Urgent") && alerts.length && !alerts.some((a) => a.severity === "CRITICAL")) {
    const worst = alerts.reduce((w, a) => (SEVERITY_RANK[a.severity] > SEVERITY_RANK[w.severity] ? a : w));
    worst.severity = "CRITICAL";
    worst.dueAt = addDays(now, DUE_DAYS.CRITICAL);
  }

  alerts.sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  let priority = 1;
  const actions: SeedAction[] = alerts.flatMap((alert) =>
    alert.riskActions.map((act, i) => ({
      id: `act_${fieldId}_${alert.category.toLowerCase()}${i + 1}`,
      alertId: alert.id,
      fieldId,
      priority: priority++,
      title: act.title,
      why: act.why,
      dueAt: addDays(now, Math.max(0, act.due_in_days)),
      done: false,
      doneAt: null,
    })),
  );

  for (const alert of alerts) delete (alert as Partial<typeof alert>).riskActions;
  return { alerts, actions };
}

/** Previsione di zona (già ridatata) → righe meteo del campo. */
export function weatherRows(fieldId: string, days: DailyForecast[]): SeedWeatherForecast[] {
  return days.map((d) => ({
    id: `wf_${fieldId}_${d.date.replaceAll("-", "")}`,
    fieldId,
    date: new Date(`${d.date}T00:00:00.000Z`),
    tempMinC: d.tempMinC,
    tempMaxC: d.tempMaxC,
    rainMm: d.rainMm,
    rainProbPct: d.rainProbPct,
    humidityPct: d.humidityPct,
  }));
}
