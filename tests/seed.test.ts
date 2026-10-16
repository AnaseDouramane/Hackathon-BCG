// seed.json valido e coerente con lo scenario della demo (spec §9.3).
import { describe, expect, it } from "vitest";
import rawSeed from "@/data/seed.json";
import { SeedSchema } from "@/lib/contract/seed-schema";
import { buildAggregates } from "@/lib/data/memory-repository";
import { computeStats } from "@/lib/domain/stats";
import { getFieldDetail, listFields } from "@/lib/services/fields";

const seed = SeedSchema.parse(rawSeed);
const aggregates = buildAggregates(seed);

describe("seed.json", () => {
  it("is valid and every relation resolves", () => {
    expect(seed.fields).toHaveLength(600);
    const alertIds = new Set(seed.alerts.map((a) => a.id));
    for (const action of seed.actions) expect(alertIds.has(action.alertId)).toBe(true);
    for (const agg of aggregates) expect(agg.planting).not.toBeNull();
  });

  it("produces the expected demo numbers", () => {
    const stats = computeStats(
      aggregates.map((a) => a.alerts),
      seed.demoNow,
    );
    expect(stats).toMatchObject({ urgent: 8, disease: 25, fertilizer: 22, maturity: 18, ok: 540, totalFields: 600 });
  });

  it("follows the honesty rule: sensor disease alerts describe conditions", () => {
    for (const a of seed.alerts.filter((x) => x.category === "DISEASE" && x.source === "SENSOR")) {
      expect(a.title.startsWith("Conditions favourable to")).toBe(true);
    }
    for (const a of seed.alerts.filter((x) => x.source !== "MANUAL")) expect(a.confidence).not.toBeNull();
  });
});

describe("services on the memory repository", () => {
  it("lists urgent fields in priority order, demo scenarios first", async () => {
    const urgent = await listFields({ category: "urgent" });
    expect(urgent).toHaveLength(8);
    expect(urgent.slice(0, 3).map((f) => f.code)).toEqual(["KSG-001", "KSG-003", "KSG-002"]);
    expect(urgent.every((f) => f.lampColors[0] === "RED")).toBe(true);
  });

  it("list lengths match the KPI numbers", async () => {
    expect(await listFields({ category: "disease" })).toHaveLength(25);
    expect(await listFields({ category: "fertilizer" })).toHaveLength(22);
    expect(await listFields({ category: "maturity" })).toHaveLength(18);
  });

  it("uses the category's own alert as topAlert", async () => {
    const fertilizer = await listFields({ category: "fertilizer" });
    expect(fertilizer.every((f) => f.topAlert?.category === "FERTILIZER")).toBe(true);
  });

  it("multi-issue field alternates colors", async () => {
    const detail = await getFieldDetail("fld_005");
    expect(detail?.lampColors).toEqual(["PURPLE", "BLUE"]);
  });

  it("detail has sorted actions and 5 weather days", async () => {
    const detail = await getFieldDetail("fld_003");
    expect(detail?.actions.map((a) => a.priority)).toEqual([1, 2, 3]);
    // l'azione 3 scade il 10 marzo: non è urgente anche se l'alert lo è
    expect(detail?.actions.map((a) => a.isUrgent)).toEqual([true, true, false]);
    expect(detail?.weather).toHaveLength(5);
    expect(detail?.weather[2]).toMatchObject({ date: "2027-03-03", rainMm: 45 });
    expect(await getFieldDetail("fld_999")).toBeNull();
  });
});
