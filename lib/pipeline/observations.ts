// Contesti e osservazioni per campo, nel formato che risk.py si aspetta (build_field_contexts + --observations).
// Il CSV ha solo anagrafica e infrastruttura: le evidenze di campo vengono dallo strato "IoT simulato"
// del seed (sensori del suolo, drone, segnalazioni della rete di monitoraggio, semina) più le API reali
// (meteo OpenWeather per zona, piano iSDA, foto analizzate da crop.health).
import type { DailyForecast } from "@/lib/external/weather";
import { type CsvRow, type KasunguDb, STATIC_FIELD_KEYS } from "@/lib/kasungu/db";
import { getSensorStatus, SENSOR_META, type SensorKey } from "@/lib/domain/sensors";
import type { FieldAggregate } from "@/lib/domain/types";
import type { PhotoFinding } from "./types";

export const HEAVY_RAIN_MM = 25;
export const HEAT_C = 35;
export const FORECAST_DAYS = 5;
const HEALTHY_NDVI = 0.65;

const DAY_MS = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

export type WeatherAlert = { event: "heavy rain" | "heat"; date: string; value: string; active: true };

/**
 * La previsione reale parte da oggi; la demo vive in un "adesso" fisso (DEMO_NOW).
 * Il giorno i della previsione diventa il giorno i a partire da "adesso".
 */
export function redateForecast(days: DailyForecast[], now: Date): DailyForecast[] {
  return days.slice(0, FORECAST_DAYS).map((d, i) => ({ ...d, date: isoDate(new Date(now.getTime() + i * DAY_MS)) }));
}

export function weatherAlerts(days: DailyForecast[]): WeatherAlert[] {
  return days.flatMap((d) => [
    ...(d.rainMm >= HEAVY_RAIN_MM ? [{ event: "heavy rain" as const, date: d.date, value: `${d.rainMm} mm`, active: true as const }] : []),
    ...(d.tempMaxC >= HEAT_C ? [{ event: "heat" as const, date: d.date, value: `${d.tempMaxC} °C`, active: true as const }] : []),
  ]);
}

export type FieldObservations = {
  crop_stage: {
    crop: string;
    growth_stage: string;
    planted_at: string;
    harvest_window: [string, string];
    days_to_harvest_start: number;
  } | null;
  /** Segnalazioni della rete di monitoraggio (sensori, drone, visite) già aperte sul campo. */
  field_reports: {
    category: string;
    severity: string;
    source: string;
    title: string;
    detail: string;
    confidence: number | null;
    detected_at: string;
    due_at: string | null;
  }[];
  soil_sensor: {
    sensor_id: string;
    measured_at: string;
    readings: Record<string, number | null>;
    out_of_range: { parameter: string; value: number; unit: string; status: "low" | "high"; min?: number; max?: number }[];
  } | null;
  drone: { captured_at: string; ndvi: number | null; findings: string | null } | null;
  fertilizer_plan?: string;
  /**
   * Foto caricate dal campo. Niente date assolute: la demo vive in un "adesso" fisso (DEMO_NOW)
   * e una data reale farebbe credere a Claude che la foto sia precedente alla semina.
   */
  photos: { is_new: boolean; days_ago: number; crop_health: PhotoFinding["cropHealth"]; visual_notes: string }[];
};

export type FieldContext = {
  field: Record<(typeof STATIC_FIELD_KEYS)[number], string>;
  zone_context: {
    zone_id: string;
    zone_name: string;
    weather_station_id: string;
    forecast: DailyForecast[];
    weather_alerts: WeatherAlert[];
  };
  gateway_context: { gateway_id: string; shared_water_channel: string };
  observations: FieldObservations;
};

export function buildFieldContext(
  row: CsvRow,
  db: KasunguDb,
  base: FieldAggregate,
  zoneForecast: DailyForecast[],
  photos: PhotoFinding[],
  now: Date,
  isNewPhoto: (photo: PhotoFinding) => boolean = () => false,
): FieldContext {
  const zone = db.zones.get(row.zone_id);
  const gateway = db.gateways.get(row.gateway_id);
  const { planting } = base;

  const reading = base.sensorReadings.at(-1);
  const outOfRange = reading
    ? (Object.keys(SENSOR_META) as SensorKey[]).flatMap((key) => {
        const value = reading[key];
        const status = getSensorStatus(key, value);
        if (value === null || status === "ok") return [];
        const { label, unit, min, max } = SENSOR_META[key];
        return [{ parameter: label, value, unit, status, min, max }];
      })
    : [];

  const drone = base.droneCaptures.at(-1);

  return {
    field: Object.fromEntries(STATIC_FIELD_KEYS.map((k) => [k, row[k] ?? ""])) as FieldContext["field"],
    zone_context: {
      zone_id: row.zone_id,
      zone_name: zone?.name ?? "",
      weather_station_id: zone?.weather_station_id ?? "",
      forecast: zoneForecast,
      weather_alerts: weatherAlerts(zoneForecast),
    },
    gateway_context: { gateway_id: row.gateway_id, shared_water_channel: gateway?.shared_water_channel ?? "" },
    observations: {
      crop_stage: planting
        ? {
            crop: planting.crop.name,
            growth_stage: planting.growthStage,
            planted_at: isoDate(planting.plantedAt),
            harvest_window: [isoDate(planting.expectedHarvestStart), isoDate(planting.expectedHarvestEnd)],
            days_to_harvest_start: Math.round((planting.expectedHarvestStart.getTime() - now.getTime()) / DAY_MS),
          }
        : null,
      field_reports: base.alerts
        .filter((a) => a.status === "OPEN")
        .map((a) => ({
          category: a.category,
          severity: a.severity,
          source: a.source,
          title: a.title,
          detail: a.description,
          confidence: a.confidence,
          detected_at: a.detectedAt.toISOString(),
          due_at: a.dueAt?.toISOString() ?? null,
        })),
      soil_sensor: reading
        ? {
            sensor_id: reading.sensorId,
            measured_at: reading.measuredAt.toISOString(),
            readings: Object.fromEntries((Object.keys(SENSOR_META) as SensorKey[]).map((k) => [k, reading[k]])),
            out_of_range: outOfRange,
          }
        : null,
      drone: drone ? { captured_at: drone.capturedAt.toISOString(), ndvi: drone.ndviMean, findings: drone.findings } : null,
      photos: photos.map((p) => ({
        is_new: isNewPhoto(p),
        days_ago: Math.max(0, Math.floor((Date.now() - Date.parse(p.uploadedAt)) / DAY_MS)),
        crop_health: p.cropHealth,
        visual_notes: p.visualNotes,
      })),
    },
  };
}

/**
 * Come in risk.py, senza evidenze di campo non c'è nessun flag: questi campi non vanno inviati a Claude.
 * Il meteo di zona da solo non basta (regola di risk.py).
 */
export function hasFieldEvidence(ctx: FieldContext, hasNewPhotos: boolean): boolean {
  const o = ctx.observations;
  const droneIssue = o.drone !== null && ((o.drone.ndvi ?? 1) < HEALTHY_NDVI || !/healthy/i.test(o.drone.findings ?? ""));
  return hasNewPhotos || o.field_reports.length > 0 || (o.soil_sensor?.out_of_range.length ?? 0) > 0 || droneIssue || o.photos.length > 0;
}

/** Serve un piano di concimazione iSDA? Solo con segnali di suolo/nutrienti. */
export function needsFertilizerPlan(ctx: FieldContext): boolean {
  const o = ctx.observations;
  return o.field_reports.some((r) => r.category === "FERTILIZER") || (o.soil_sensor?.out_of_range.length ?? 0) > 0;
}
