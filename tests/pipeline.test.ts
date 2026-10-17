// Pipeline delle API (port dei client di Anase): osservazioni, conversione in alert, diff, orchestrazione.
// Nessuna chiamata vera: le API esterne sono mockate.
import { beforeEach, describe, expect, it, vi } from "vitest";
import rawSeed from "@/data/seed.json";
import { SeedSchema } from "@/lib/contract/seed-schema";
import { buildAggregates } from "@/lib/data/memory-repository";
import { getLampColors } from "@/lib/domain/lamp";
import { parseIdentification } from "@/lib/external/crophealth";
import { type RiskResult, validateResult } from "@/lib/external/risk";
import { toDailyForecast } from "@/lib/external/weather";
import { loadKasunguDb } from "@/lib/kasungu/db";
import { diffSeeds } from "@/lib/pipeline/diff";
import { buildFieldContext, hasFieldEvidence, redateForecast, weatherAlerts } from "@/lib/pipeline/observations";
import { alertsFromRisk } from "@/lib/pipeline/to-seed";

const risk = vi.hoisted(() => ({ enabled: false, classify: vi.fn() }));
vi.mock("@/lib/external/risk", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/external/risk")>()),
  isRiskEnabled: () => risk.enabled,
  classifyFields: risk.classify,
}));

const seed = SeedSchema.parse(rawSeed);
const aggregates = buildAggregates(seed);
const byId = new Map(aggregates.map((a) => [a.field.id, a]));
const now = seed.demoNow;
const db = loadKasunguDb();
const row = (id: string) => db.fields.find((f) => f.field_id === id)!;
const healthyId = aggregates.find((a) => a.alerts.length === 0 && a.droneCaptures.length === 0)!.field.id;

const riskResult = (fieldId: string, over: Partial<RiskResult> = {}): RiskResult => ({
  field_id: fieldId,
  flags: ["Disease"],
  severity: "moderate",
  alerts: [
    {
      type: "Disease",
      severity: "moderate",
      title: "Suspected northern leaf blight",
      evidence: "Photo shows long grey-green lesions on lower leaves.",
      rationale: "crop.health suggests northern leaf blight (0.82).",
      source: "MANUAL",
      confidence: 0.82,
      actions: [
        { title: "Check 10 plants for lesions", why: "Confirm the photo finding.", due_in_days: 1 },
        { title: "Plan a rotation", why: "The fungus survives on residue.", due_in_days: 30 },
      ],
    },
  ],
  photo_notes: "Maize leaf with elongated grey lesions.",
  ...over,
});

describe("observations (risk.py format)", () => {
  it("turns an out-of-range soil sensor into evidence", () => {
    const lowN = aggregates.find((a) => a.sensorReadings[0]?.nPpm === 9)!;
    const ctx = buildFieldContext(row(lowN.field.id), db, lowN, [], [], now);
    expect(ctx.observations.soil_sensor?.out_of_range).toContainEqual(expect.objectContaining({ parameter: "Nitrogen (N)", status: "low" }));
    expect(hasFieldEvidence(ctx, false)).toBe(true);
    expect(ctx.field).not.toHaveProperty("farmer");
  });

  it("a healthy field has no evidence, unless a new photo was uploaded", () => {
    const ctx = buildFieldContext(row(healthyId), db, byId.get(healthyId)!, [], [], now);
    expect(hasFieldEvidence(ctx, false)).toBe(false);
    expect(hasFieldEvidence(ctx, true)).toBe(true);
  });

  it("re-dates the real forecast onto the demo days and flags heavy rain", () => {
    const days = redateForecast(
      [
        { date: "2026-10-17", tempMinC: 15, tempMaxC: 30, rainMm: 0, rainProbPct: 0, humidityPct: 30 },
        { date: "2026-10-18", tempMinC: 16, tempMaxC: 36, rainMm: 31, rainProbPct: 90, humidityPct: 80 },
      ],
      now,
    );
    expect(days.map((d) => d.date)).toEqual(["2027-03-01", "2027-03-02"]);
    expect(weatherAlerts(days).map((a) => a.event)).toEqual(["heavy rain", "heat"]);
  });
});

describe("external API parsers", () => {
  it("aggregates the OpenWeather 3-hour forecast into days", () => {
    const step = (dt: number, min: number, max: number, rain?: number) => ({
      dt,
      main: { temp_min: min, temp_max: max, humidity: 50 },
      pop: 0.4,
      ...(rain ? { rain: { "3h": rain } } : {}),
    });
    const days = toDailyForecast({ city: { timezone: 7200 }, list: [step(1792224000, 14, 20, 2), step(1792234800, 18, 29, 3.4), step(1792310400, 15, 22)] });
    expect(days[0]).toMatchObject({ tempMinC: 14, tempMaxC: 29, rainMm: 5, rainProbPct: 40 });
    expect(days).toHaveLength(2);
  });

  it("keeps the top crop.health suggestions", () => {
    const parsed = parseIdentification({
      result: {
        is_plant: { probability: 0.99 },
        disease: { suggestions: [{ name: "northern leaf blight", probability: 0.8234 }, { name: "rust", probability: 0.1 }] },
      },
    });
    expect(parsed.diseases[0]).toEqual({ name: "northern leaf blight", probability: 0.82 });
    expect(parsed.crops).toEqual([]);
  });

  it("validates Claude output like risk.py: no flag without an alert, no alert without evidence", () => {
    const result = validateResult(
      riskResult("F01", {
        flags: ["Disease", "Fertilizer"],
        alerts: [
          { ...riskResult("F01").alerts[0] },
          { ...riskResult("F01").alerts[0], type: "Maturity", evidence: "  " },
        ],
      }),
    );
    expect(result.flags).toEqual(["Disease"]);
    expect(result.alerts).toHaveLength(1);
  });
});

describe("Claude results → seed alerts", () => {
  it("a moderate disease makes the field purple, with prioritised actions", () => {
    const { alerts, actions } = alertsFromRisk(riskResult(healthyId), byId.get(healthyId)!, now);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ category: "DISEASE", severity: "MEDIUM", source: "MANUAL", status: "OPEN" });
    expect(getLampColors(alerts, now)).toEqual(["PURPLE"]);
    expect(actions.map((a) => a.priority)).toEqual([1, 2]);
  });

  it("the Urgent flag makes the worst alert critical, so the field turns red", () => {
    const { alerts } = alertsFromRisk(riskResult(healthyId, { flags: ["Disease", "Urgent"] }), byId.get(healthyId)!, now);
    expect(alerts[0].severity).toBe("CRITICAL");
    expect(getLampColors(alerts, now)).toEqual(["RED"]);
  });
});

describe("diff between two analyses", () => {
  it("reports new issues and the colour change", () => {
    const { alerts, actions } = alertsFromRisk(riskResult(healthyId), byId.get(healthyId)!, now);
    const after = { ...seed, alerts: [...seed.alerts, ...alerts], actions: [...seed.actions, ...actions] };
    const changes = diffSeeds(seed, after, now);
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ fieldId: healthyId, before: ["GREEN"], after: ["PURPLE"] });
    expect(changes[0].added[0].title).toBe("Suspected northern leaf blight");
    expect(diffSeeds(after, seed, now)[0].resolved).toHaveLength(1);
  });
});

describe("runAnalysis", () => {
  beforeEach(() => {
    risk.enabled = false;
    risk.classify.mockReset();
    // niente chiamate vere anche se le chiavi sono nell'ambiente
    for (const key of ["OPENWEATHER_API_KEY", "CROP_HEALTH_API_KEY", "ISDA_USERNAME", "ISDA_PASSWORD"]) vi.stubEnv(key, "");
  });

  it("without API keys keeps the previous alerts and reports the skipped sources", async () => {
    const { runAnalysis } = await import("@/lib/pipeline/run");
    const out = await runAnalysis({ base: seed, previous: seed, previousPhotos: {}, newPhotos: [], now });
    expect(out.changes).toEqual([]);
    expect(out.seed.alerts).toHaveLength(seed.alerts.length);
    expect(out.sources.every((s) => s.status === "skipped")).toBe(true);
  });

  it("a new photo on a healthy field adds the issue found by the risk analysis", async () => {
    risk.enabled = true;
    risk.classify.mockImplementation(async (fields: { field: { field_id: string } }[]) =>
      fields.map((f) => (f.field.field_id === healthyId ? riskResult(healthyId) : { field_id: f.field.field_id, flags: [], severity: "none", alerts: [], photo_notes: "" })),
    );
    const { runAnalysis } = await import("@/lib/pipeline/run");
    const photo = { fieldId: healthyId, url: "/api/files/photos/pending/x.jpg", uploadedAt: now, bytes: Buffer.from("jpeg") };
    const out = await runAnalysis({ base: seed, previous: seed, previousPhotos: {}, newPhotos: [photo], now });

    const photoCall = risk.classify.mock.calls.find(([fields]) => fields[0].field.field_id === healthyId)!;
    expect(photoCall[2]).toHaveLength(1); // l'immagine va a Claude
    expect(out.changes.find((c) => c.fieldId === healthyId)).toMatchObject({ before: ["GREEN"], after: ["PURPLE"] });
    expect(out.photos[healthyId][0].visualNotes).toBe("Maize leaf with elongated grey lesions.");
  });

  it("a second run with the same evidence does not call Claude and reports no changes", async () => {
    risk.enabled = true;
    risk.classify.mockImplementation(async (fields: { field: { field_id: string } }[]) =>
      fields.map((f) => ({ field_id: f.field.field_id, flags: [], severity: "none", alerts: [], photo_notes: "" })),
    );
    const { runAnalysis } = await import("@/lib/pipeline/run");
    const first = await runAnalysis({ base: seed, previous: seed, previousPhotos: {}, newPhotos: [], now });
    expect(risk.classify).toHaveBeenCalled();
    expect(Object.keys(first.fingerprints).length).toBeGreaterThan(0);

    risk.classify.mockClear();
    const second = await runAnalysis({
      base: seed,
      previous: first.seed,
      previousPhotos: first.photos,
      previousFingerprints: first.fingerprints,
      newPhotos: [],
      now,
    });
    expect(risk.classify).not.toHaveBeenCalled();
    expect(second.changes).toEqual([]);
    expect(second.seed.alerts).toEqual(first.seed.alerts);
    expect(second.sources.find((s) => s.name === "claude")).toMatchObject({ status: "ok", detail: "no field evidence changed" });
  });

  it("onlyFieldIds analyses just that field and leaves the others as they were", async () => {
    risk.enabled = true;
    risk.classify.mockImplementation(async (fields: { field: { field_id: string } }[]) => fields.map((f) => riskResult(f.field.field_id)));
    const { runAnalysis } = await import("@/lib/pipeline/run");
    const photo = { fieldId: healthyId, url: "/api/files/photos/pending/y.jpg", uploadedAt: now, bytes: Buffer.from("jpeg") };
    const out = await runAnalysis({ base: seed, previous: seed, previousPhotos: {}, newPhotos: [photo], onlyFieldIds: [healthyId], now });

    expect(risk.classify).toHaveBeenCalledTimes(1);
    expect(out.changes.map((c) => c.fieldId)).toEqual([healthyId]);
    const others = (s: typeof seed) => s.alerts.filter((a) => a.fieldId !== healthyId);
    expect(others(out.seed)).toEqual(others(seed));
    expect(out.seed.weatherForecasts.filter((w) => w.fieldId !== healthyId)).toEqual(seed.weatherForecasts.filter((w) => w.fieldId !== healthyId));
  });
});
