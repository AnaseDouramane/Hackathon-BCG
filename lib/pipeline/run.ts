// La catena di Anase in un'unica funzione: meteo → (iSDA, crop.health) → osservazioni → Claude risk → seed.
// Ogni fonte è indipendente: se una fallisce si va avanti con le altre e lo si registra in `sources`.
// Claude rivaluta solo i campi le cui evidenze sono cambiate (impronta diversa dall'analisi precedente):
// gli altri tengono il risultato precedente, così "What changed" mostra solo cambiamenti veri.
// Con `onlyFieldIds` (foto appena caricata) si analizzano solo quei campi; il resto resta com'era.
import { createHash } from "node:crypto";
import type { Seed, SeedAction, SeedAlert, SeedWeatherForecast } from "@/lib/contract/seed-schema";
import { buildAggregates } from "@/lib/data/memory-repository";
import { type CropHealthResult, identify, isCropHealthEnabled } from "@/lib/external/crophealth";
import { getNutrientPlan, isIsdaEnabled } from "@/lib/external/isda";
import { classifyFields, isRiskEnabled, type RiskImage, type RiskResult } from "@/lib/external/risk";
import { type DailyForecast, getDailyForecast, isWeatherEnabled } from "@/lib/external/weather";
import { loadKasunguDb } from "@/lib/kasungu/db";
import { diffSeeds } from "./diff";
import { buildFieldContext, type FieldContext, hasFieldEvidence, needsFertilizerPlan, redateForecast } from "./observations";
import { cropHealthAlert, ensurePhotoIssue } from "./photo-issue";
import { alertsFromRisk, weatherRows } from "./to-seed";
import type { FieldChange, PhotoFinding, SourceStatus } from "./types";

const BATCH_SIZE = 12;
const PARALLEL_CLAUDE_CALLS = 5;
const MAX_PLAN_CHARS = 1500;

export type NewPhoto = { fieldId: string; url: string; uploadedAt: Date; bytes: Buffer };

export type RunInput = {
  /** Strato "IoT simulato" (data/seed.json): sensori, drone, semine, segnalazioni. */
  base: Seed;
  /** Ultima analisi (o il seed se è la prima): serve per il diff e come rete di sicurezza. */
  previous: Seed;
  previousPhotos: Record<string, PhotoFinding[]>;
  /** Impronte delle evidenze dell'analisi precedente, per campo. */
  previousFingerprints?: Record<string, string>;
  newPhotos: NewPhoto[];
  /** Se presente, si analizzano solo questi campi. */
  onlyFieldIds?: string[];
  now: Date;
};

export type RunOutput = {
  seed: Seed;
  sources: SourceStatus[];
  changes: FieldChange[];
  photos: Record<string, PhotoFinding[]>;
  fingerprints: Record<string, string>;
};

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

function status(name: SourceStatus["name"], enabled: boolean, total: number, failed: string[], idle = "nothing to analyse"): SourceStatus {
  if (!enabled) return { name, status: "skipped", detail: "no API key configured" };
  if (total === 0) return { name, status: name === "claude" ? "ok" : "skipped", detail: idle };
  if (failed.length === 0) return { name, status: "ok" };
  return { name, status: failed.length === total ? "error" : "partial", detail: failed[0] };
}

/**
 * Impronta delle evidenze di un campo: osservazioni di campo + eventi meteo di zona (non i valori grezzi
 * della previsione, che cambiano ogni 3 ore). Delle foto contano data e risultato di crop.health.
 */
export function evidenceFingerprint(ctx: FieldContext): string {
  // il piano iSDA si chiede solo per i campi cambiati: non entra nell'impronta
  const { photos, crop_stage, field_reports, soil_sensor, drone } = ctx.observations;
  const payload = {
    crop_stage,
    field_reports,
    soil_sensor,
    drone,
    photos: photos.map((p) => p.crop_health),
    weather_alerts: ctx.zone_context.weather_alerts.map((a) => `${a.event}@${a.date}`),
  };
  return createHash("sha1").update(JSON.stringify(payload)).digest("hex");
}

const groupByField = <T extends { fieldId: string }>(rows: T[]) => {
  const map = new Map<string, T[]>();
  for (const r of rows) map.set(r.fieldId, [...(map.get(r.fieldId) ?? []), r]);
  return map;
};

export async function runAnalysis(input: RunInput): Promise<RunOutput> {
  const { base, previous, previousPhotos, newPhotos, now } = input;
  const previousFingerprints = input.previousFingerprints ?? {};
  const scope = input.onlyFieldIds ? new Set(input.onlyFieldIds) : null;
  const inScope = (id: string) => !scope || scope.has(id);

  const db = loadKasunguDb();
  const baseById = new Map(buildAggregates(base).map((a) => [a.field.id, a]));
  const rows = db.fields.filter((r) => baseById.has(r.field_id) && inScope(r.field_id));

  // 1) Meteo reale: una chiamata per stazione di zona (solo le zone dei campi da analizzare)
  const zoneForecast = new Map<string, DailyForecast[]>();
  const weatherFailed: string[] = [];
  const zoneIds = [...new Set(rows.map((r) => r.zone_id))];
  if (isWeatherEnabled()) {
    await Promise.all(
      zoneIds.map(async (zoneId) => {
        const z = db.zones.get(zoneId);
        if (!z) return;
        try {
          const days = await getDailyForecast(Number(z.weather_station_lat), Number(z.weather_station_lon));
          zoneForecast.set(zoneId, redateForecast(days, now));
        } catch (err) {
          weatherFailed.push(`${zoneId}: ${errorText(err)}`);
        }
      }),
    );
  }

  // 2) Foto nuove: crop.health (malattie) su ciascuna; le immagini vanno anche a Claude
  const cropHealthFailed: string[] = [];
  const newPhotoResults = await Promise.all(
    newPhotos.map(async (photo) => {
      const row = db.fields.find((f) => f.field_id === photo.fieldId);
      const base64 = photo.bytes.toString("base64");
      let cropHealth: CropHealthResult | null = null;
      if (isCropHealthEnabled() && row) {
        try {
          cropHealth = await identify(base64, Number(row.lat), Number(row.lon));
        } catch (err) {
          cropHealthFailed.push(errorText(err));
        }
      }
      return { photo, base64, cropHealth };
    }),
  );
  const fieldsWithNewPhotos = new Set(newPhotos.map((p) => p.fieldId));
  const newPhotoUrls = new Set(newPhotos.map((p) => p.url));

  // 3) Contesti per campo (formato risk.py) e impronte; le foto nuove contano con il risultato di crop.health
  const prevWeather = groupByField(previous.weatherForecasts);
  const contexts = new Map<string, FieldContext>();
  for (const row of rows) {
    const agg = baseById.get(row.field_id)!;
    // senza meteo nuovo si usa quello dell'analisi precedente, così l'impronta non cambia per un errore di rete
    const forecast =
      zoneForecast.get(row.zone_id) ??
      (prevWeather.get(row.field_id) ?? []).map((w) => ({
        date: w.date.toISOString().slice(0, 10),
        tempMinC: w.tempMinC,
        tempMaxC: w.tempMaxC,
        rainMm: w.rainMm,
        rainProbPct: w.rainProbPct,
        humidityPct: w.humidityPct,
      }));
    const photos = [
      ...(previousPhotos[row.field_id] ?? []),
      ...newPhotoResults
        .filter((r) => r.photo.fieldId === row.field_id)
        .map((r) => ({ url: r.photo.url, uploadedAt: r.photo.uploadedAt.toISOString(), analysedAt: new Date().toISOString(), cropHealth: r.cropHealth, visualNotes: "" })),
    ];
    contexts.set(row.field_id, buildFieldContext(row, db, agg, forecast, photos, now, (p) => newPhotoUrls.has(p.url)));
  }
  const candidates = [...contexts.values()].filter((c) => hasFieldEvidence(c, fieldsWithNewPhotos.has(c.field.field_id)));
  const fingerprintOf = new Map(candidates.map((c) => [c.field.field_id, evidenceFingerprint(c)]));
  const changed = candidates.filter((c) => fingerprintOf.get(c.field.field_id) !== previousFingerprints[c.field.field_id]);

  // 4) iSDA: piano nutrienti per coltura × zona, solo per i campi da rivalutare con segnali di suolo/nutrienti
  const isdaFailed = new Map<string, string>();
  const planKeys = new Map<string, Promise<unknown | null>>();
  const needPlan = isIsdaEnabled() ? changed.filter(needsFertilizerPlan) : [];
  await Promise.all(
    needPlan.map(async (ctx) => {
      const crop = baseById.get(ctx.field.field_id)?.planting?.crop.code ?? "";
      const key = `${crop}|${ctx.field.zone_id}`;
      if (!planKeys.has(key)) {
        const zone = db.zones.get(ctx.field.zone_id);
        planKeys.set(key, getNutrientPlan(crop, Number(zone?.weather_station_lat ?? ctx.field.lat), Number(zone?.weather_station_lon ?? ctx.field.lon)));
      }
      try {
        const plan = await planKeys.get(key);
        if (plan) ctx.observations.fertilizer_plan = JSON.stringify(plan).slice(0, MAX_PLAN_CHARS);
      } catch (err) {
        isdaFailed.set(key, errorText(err));
      }
    }),
  );

  // 5) Claude risk sui campi cambiati: a gruppi; i campi con foto nuove uno alla volta, con le immagini
  const results = new Map<string, RiskResult>();
  const claudeFailed: string[] = [];
  const photoCandidates = changed.filter((c) => fieldsWithNewPhotos.has(c.field.field_id));
  const otherCandidates = changed.filter((c) => !fieldsWithNewPhotos.has(c.field.field_id));
  const batches: { fields: FieldContext[]; images: RiskImage[] }[] = [
    ...photoCandidates.map((c) => ({
      fields: [c],
      images: newPhotoResults
        .filter((r) => r.photo.fieldId === c.field.field_id)
        .map((r) => ({ fieldId: r.photo.fieldId, base64: r.base64, mediaType: "image/jpeg" as const, cropHealth: r.cropHealth })),
    })),
    ...Array.from({ length: Math.ceil(otherCandidates.length / BATCH_SIZE) }, (_, i) => ({
      fields: otherCandidates.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE),
      images: [],
    })),
  ];
  if (isRiskEnabled()) {
    await mapLimit(batches, PARALLEL_CLAUDE_CALLS, async (batch) => {
      // i campi che Claude ha saltato vengono richiesti una seconda volta, da soli
      let todo = batch.fields;
      for (let attempt = 0; attempt < 2 && todo.length; attempt++) {
        try {
          for (const r of await classifyFields(todo, now, batch.images)) results.set(r.field_id, r);
        } catch (err) {
          claudeFailed.push(errorText(err));
          return;
        }
        todo = todo.filter((c) => !results.has(c.field.field_id));
      }
      if (todo.length) claudeFailed.push(`No result for ${todo.map((c) => c.field.field_id).join(", ")}`);
    });
  }

  // 5b) Foto: se crop.health ha trovato un problema che Claude non ha trasformato in alert, lo si aggiunge
  const photoAlerts = new Map(
    [...fieldsWithNewPhotos].map((id) => [id, cropHealthAlert(newPhotoResults.filter((r) => r.photo.fieldId === id).map((r) => r.cropHealth))]),
  );
  for (const [id, alert] of photoAlerts) {
    const result = results.get(id);
    if (result) results.set(id, ensurePhotoIssue(result, alert));
  }

  // 6) Nuove tabelle. Per campo: risultato nuovo di Claude, oppure quanto si sapeva già
  //    (fuori dal perimetro, evidenze invariate, Claude assente o fallito); senza evidenze nessun alert.
  const prevAlerts = groupByField(previous.alerts);
  const prevActions = groupByField(previous.actions);
  const alerts: SeedAlert[] = [];
  const actions: SeedAction[] = [];
  const weatherForecasts: SeedWeatherForecast[] = [];
  const fingerprints: Record<string, string> = { ...previousFingerprints };

  for (const row of db.fields) {
    const id = row.field_id;
    const agg = baseById.get(id);
    if (!agg) continue;
    const keepPrevious = () => {
      alerts.push(...(prevAlerts.get(id) ?? []));
      actions.push(...(prevActions.get(id) ?? []));
    };
    const forecast = zoneForecast.get(row.zone_id);
    weatherForecasts.push(...(inScope(id) && forecast ? weatherRows(id, forecast) : (prevWeather.get(id) ?? [])));
    if (!inScope(id)) {
      keepPrevious();
      continue;
    }

    const fingerprint = fingerprintOf.get(id);
    const result = results.get(id);
    if (result) {
      const out = alertsFromRisk(result, agg, now);
      alerts.push(...out.alerts);
      actions.push(...out.actions);
      fingerprints[id] = fingerprint!;
    } else if (fingerprint && fingerprint === previousFingerprints[id]) {
      keepPrevious(); // evidenze invariate: stesso risultato di prima
    } else if (fingerprint || !isRiskEnabled()) {
      // da rivalutare ma Claude assente o fallito: si tiene quanto si sapeva, più l'eventuale alert della foto,
      // e si riprova al prossimo giro
      const photoAlert = photoAlerts.get(id);
      if (photoAlert) {
        const out = alertsFromRisk({ field_id: id, flags: [photoAlert.type], severity: photoAlert.severity, alerts: [photoAlert], photo_notes: "" }, agg, now);
        const replaced = new Set(out.alerts.map((a) => a.category));
        const kept = (prevAlerts.get(id) ?? []).filter((a) => !replaced.has(a.category));
        const keptIds = new Set(kept.map((a) => a.id));
        alerts.push(...kept, ...out.alerts);
        actions.push(...(prevActions.get(id) ?? []).filter((a) => keptIds.has(a.alertId)), ...out.actions);
      } else {
        keepPrevious();
      }
      delete fingerprints[id];
    } else {
      delete fingerprints[id]; // nessuna evidenza di campo → nessun alert (come risk.py: flags [])
    }
  }

  // 7) Foto analizzate: si aggiungono a quelle precedenti, con le note visive di Claude
  const photos: Record<string, PhotoFinding[]> = structuredClone(previousPhotos);
  for (const { photo, cropHealth } of newPhotoResults) {
    (photos[photo.fieldId] ??= []).push({
      url: photo.url,
      uploadedAt: photo.uploadedAt.toISOString(),
      analysedAt: new Date().toISOString(),
      cropHealth,
      visualNotes: results.get(photo.fieldId)?.photo_notes ?? "",
    });
  }

  const seed: Seed = { ...base, alerts, actions, weatherForecasts };
  const sources: SourceStatus[] = [
    status("weather", isWeatherEnabled(), zoneIds.length, weatherFailed),
    status("isda", isIsdaEnabled(), planKeys.size, [...isdaFailed.values()]),
    status("cropHealth", isCropHealthEnabled(), newPhotos.length, cropHealthFailed, "no new photos"),
    status("claude", isRiskEnabled(), batches.length, claudeFailed, "no field evidence changed"),
  ];
  return { seed, sources, changes: diffSeeds(previous, seed, now), photos, fingerprints };
}
