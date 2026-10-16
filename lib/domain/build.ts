// Trasforma un FieldAggregate nelle risposte del contratto (spec §7).
import type {
  ActionDto,
  AlertDto,
  CategoryFilter,
  FieldDetail,
  FieldSummary,
  TopAlert,
} from "@/lib/contract/schemas";
import type { SeedAlert } from "@/lib/contract/seed-schema";
import { CATEGORY_LAMP_ORDER } from "./colors";
import { getLampColors } from "./lamp";
import { sortActions, sortAlerts } from "./priority";
import type { FieldAggregate } from "./types";
import { isActionUrgent, isUrgent, openAlerts } from "./urgency";

const WEATHER_DAYS = 5;

const toIso = (d: Date | null) => (d ? d.toISOString() : null);
const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);

/** Gli alert che rispettano il filtro di categoria (`urgent` = solo gli urgenti). */
export function alertsMatching(alerts: SeedAlert[], filter: CategoryFilter | undefined, now: Date): SeedAlert[] {
  const open = openAlerts(alerts);
  if (!filter) return open;
  if (filter === "urgent") return open.filter((a) => isUrgent(a, now));
  return open.filter((a) => a.category === filter.toUpperCase());
}

export function toAlertDto(alert: SeedAlert, now: Date): AlertDto {
  return {
    id: alert.id,
    category: alert.category,
    severity: alert.severity,
    title: alert.title,
    description: alert.description,
    source: alert.source,
    detectedAt: alert.detectedAt.toISOString(),
    dueAt: toIso(alert.dueAt),
    confidence: alert.confidence,
    isUrgent: isUrgent(alert, now),
  };
}

function toTopAlert(alert: SeedAlert, now: Date): TopAlert {
  const { id, category, severity, title, source, dueAt, confidence, isUrgent } = toAlertDto(alert, now);
  return { id, category, severity, title, source, dueAt, confidence, isUrgent };
}

export function toFieldSummary(agg: FieldAggregate, now: Date, filter?: CategoryFilter): FieldSummary {
  const { field, farmer, planting } = agg;
  const open = openAlerts(agg.alerts);
  const present = new Set(open.map((a) => a.category));
  const [top] = sortAlerts(alertsMatching(agg.alerts, filter, now), now);

  return {
    id: field.id,
    code: field.code,
    name: field.name,
    crop: planting ? { code: planting.crop.code, name: planting.crop.name } : null,
    areaHa: field.areaHa,
    farmerName: farmer.name,
    village: farmer.village,
    boundary: field.boundary,
    centroid: { lat: field.centroidLat, lng: field.centroidLng },
    categories: CATEGORY_LAMP_ORDER.filter((c) => present.has(c)),
    isUrgent: open.some((a) => isUrgent(a, now)),
    lampColors: getLampColors(agg.alerts, now),
    openAlertsCount: open.length,
    topAlert: top ? toTopAlert(top, now) : null,
  };
}

export function toFieldDetail(agg: FieldAggregate, now: Date): FieldDetail {
  const open = sortAlerts(openAlerts(agg.alerts), now);
  const alertById = new Map(open.map((a) => [a.id, a]));

  const actions: ActionDto[] = sortActions(agg.actions.filter((a) => alertById.has(a.alertId))).map((action) => {
    const alert = alertById.get(action.alertId)!;
    return {
      id: action.id,
      alertId: action.alertId,
      priority: action.priority,
      title: action.title,
      why: action.why,
      dueAt: toIso(action.dueAt),
      category: alert.category,
      source: alert.source,
      confidence: alert.confidence,
      isUrgent: isActionUrgent(alert, action.dueAt, now),
      done: action.done,
    };
  });

  const latestSensor = [...agg.sensorReadings].sort((a, b) => b.measuredAt.getTime() - a.measuredAt.getTime())[0];
  const latestDrone = [...agg.droneCaptures].sort((a, b) => b.capturedAt.getTime() - a.capturedAt.getTime())[0];
  const today = toIsoDate(now);
  const weather = agg.weatherForecasts
    .filter((w) => toIsoDate(w.date) >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, WEATHER_DAYS);

  return {
    ...toFieldSummary(agg, now),
    farmer: { name: agg.farmer.name, phone: agg.farmer.phone, village: agg.farmer.village },
    planting: agg.planting
      ? {
          crop: { code: agg.planting.crop.code, name: agg.planting.crop.name },
          plantedAt: toIsoDate(agg.planting.plantedAt),
          expectedHarvestStart: toIsoDate(agg.planting.expectedHarvestStart),
          expectedHarvestEnd: toIsoDate(agg.planting.expectedHarvestEnd),
          growthStage: agg.planting.growthStage,
        }
      : null,
    alerts: open.map((a) => toAlertDto(a, now)),
    actions,
    latestSensorReading: latestSensor
      ? {
          measuredAt: latestSensor.measuredAt.toISOString(),
          soilMoisturePct: latestSensor.soilMoisturePct,
          soilTempC: latestSensor.soilTempC,
          ph: latestSensor.ph,
          nPpm: latestSensor.nPpm,
          pPpm: latestSensor.pPpm,
          kPpm: latestSensor.kPpm,
        }
      : null,
    weather: weather.map((w) => ({
      date: toIsoDate(w.date),
      tempMinC: w.tempMinC,
      tempMaxC: w.tempMaxC,
      rainMm: w.rainMm,
      rainProbPct: w.rainProbPct,
      humidityPct: w.humidityPct,
    })),
    latestDroneCapture: latestDrone
      ? {
          capturedAt: latestDrone.capturedAt.toISOString(),
          imageUrl: latestDrone.imageUrl,
          ndviMean: latestDrone.ndviMean,
          findings: latestDrone.findings,
        }
      : null,
  };
}
