import { describe, expect, it } from "vitest";
import rawSeed from "@/data/seed.json";
import { SeedSchema } from "@/lib/contract/seed-schema";
import { buildAggregates } from "@/lib/data/memory-repository";
import { photoCaption, type RiskResult } from "@/lib/external/risk";
import { loadKasunguDb } from "@/lib/kasungu/db";
import { buildFieldContext } from "@/lib/pipeline/observations";
import { cropHealthAlert, ensurePhotoIssue } from "@/lib/pipeline/photo-issue";

const deficiency = { isPlantProbability: 0.9, crops: [{ name: "tobacco", probability: 0.6 }], diseases: [{ name: "nutrient deficiency", probability: 0.92 }] };
const healthy = { isPlantProbability: 0.9, crops: [{ name: "corn", probability: 0.99 }], diseases: [{ name: "healthy", probability: 0.99 }] };
const noIssue: RiskResult = { field_id: "F16", flags: [], severity: "none", alerts: [], photo_notes: "Leaf with holes." };

describe("photo safety net", () => {
  it("turns a crop.health problem into an alert of the right type", () => {
    const alert = cropHealthAlert([deficiency])!;
    expect(alert).toMatchObject({ type: "Fertilizer", severity: "high", source: "MANUAL", confidence: 0.92 });
    expect(alert.title).toBe("Suspected nutrient deficiency (photo)");
    expect(cropHealthAlert([{ ...deficiency, diseases: [{ name: "leaf blight", probability: 0.7 }] }])?.type).toBe("Disease");
  });

  it("raises nothing for a healthy plant or a weak identification", () => {
    expect(cropHealthAlert([healthy])).toBeNull();
    expect(cropHealthAlert([{ ...deficiency, diseases: [{ name: "rust", probability: 0.3 }] }])).toBeNull();
    expect(cropHealthAlert([null])).toBeNull();
  });

  it("adds the alert when Claude raised nothing, and keeps Claude's own alert otherwise", () => {
    const withIssue = ensurePhotoIssue(noIssue, cropHealthAlert([deficiency]));
    expect(withIssue.flags).toEqual(["Fertilizer"]);
    expect(withIssue.alerts).toHaveLength(1);
    const claudeAlert = { ...cropHealthAlert([deficiency])!, title: "Suspected potassium deficiency" };
    expect(ensurePhotoIssue({ ...noIssue, flags: ["Fertilizer"], alerts: [claudeAlert] }, cropHealthAlert([deficiency])).alerts).toEqual([claudeAlert]);
  });

  it("gives Claude the crop.health result next to the image", () => {
    expect(photoCaption({ fieldId: "F16", base64: "", mediaType: "image/jpeg", cropHealth: deficiency })).toBe(
      "New photo uploaded for field F16. crop.health on this photo: issues nutrient deficiency (92%); crop tobacco (60%).",
    );
  });

  it("describes photos without absolute dates (the demo lives on DEMO_NOW)", () => {
    const seed = SeedSchema.parse(rawSeed);
    const agg = buildAggregates(seed)[0];
    const db = loadKasunguDb();
    const row = db.fields.find((f) => f.field_id === agg.field.id)!;
    const photo = { url: "u", uploadedAt: new Date().toISOString(), analysedAt: "", cropHealth: deficiency, visualNotes: "" };
    const ctx = buildFieldContext(row, db, agg, [], [photo], seed.demoNow, () => true);
    expect(ctx.observations.photos).toEqual([{ is_new: true, days_ago: 0, crop_health: deficiency, visual_notes: "" }]);
  });
});
