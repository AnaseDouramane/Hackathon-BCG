// Test minimi obbligatori (spec §6.6).
import { describe, expect, it } from "vitest";
import { getConfidenceLabel } from "@/lib/domain/confidence";
import { getLampColors } from "@/lib/domain/lamp";
import { compareAlerts, sortActions } from "@/lib/domain/priority";
import type { AlertLike } from "@/lib/domain/types";
import { isUrgent } from "@/lib/domain/urgency";

const now = new Date("2027-03-01T05:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3600_000);

let seq = 0;
const alert = (over: Partial<AlertLike> = {}): AlertLike => ({
  id: `a${seq++}`,
  category: "DISEASE",
  severity: "MEDIUM",
  status: "OPEN",
  dueAt: null,
  ...over,
});

describe("isUrgent (§6.2)", () => {
  it("CRITICAL without due date is urgent", () => {
    expect(isUrgent(alert({ severity: "CRITICAL" }), now)).toBe(true);
  });
  it("HIGH due in 48h is urgent", () => {
    expect(isUrgent(alert({ severity: "HIGH", dueAt: inHours(48) }), now)).toBe(true);
  });
  it("HIGH due in 5 days is not urgent", () => {
    expect(isUrgent(alert({ severity: "HIGH", dueAt: inHours(5 * 24) }), now)).toBe(false);
  });
  it("CRITICAL but RESOLVED is not urgent", () => {
    expect(isUrgent(alert({ severity: "CRITICAL", status: "RESOLVED" }), now)).toBe(false);
  });
});

describe("getLampColors (§6.3)", () => {
  it("DISEASE + FERTILIZER → purple and blue", () => {
    expect(getLampColors([alert({ category: "FERTILIZER" }), alert({ category: "DISEASE" })], now)).toEqual([
      "PURPLE",
      "BLUE",
    ]);
  });
  it("urgent MATURITY + DISEASE → red", () => {
    expect(
      getLampColors([alert({ category: "MATURITY", severity: "CRITICAL" }), alert({ category: "DISEASE" })], now),
    ).toEqual(["RED"]);
  });
  it("no open alerts → green", () => {
    expect(getLampColors([alert({ status: "RESOLVED" })], now)).toEqual(["GREEN"]);
    expect(getLampColors([], now)).toEqual(["GREEN"]);
  });
});

describe("priority (§6.4)", () => {
  it("urgent first, then severity, then due date, then category", () => {
    const urgent = alert({ severity: "HIGH", dueAt: inHours(24) });
    const critical = alert({ severity: "CRITICAL", dueAt: inHours(10) });
    const highLater = alert({ severity: "HIGH", dueAt: inHours(200) });
    const highSoonerFertilizer = alert({ severity: "HIGH", dueAt: inHours(100), category: "FERTILIZER" });
    const sorted = [highLater, urgent, highSoonerFertilizer, critical].sort((a, b) => compareAlerts(a, b, now));
    expect(sorted).toEqual([critical, urgent, highSoonerFertilizer, highLater]);
  });
  it("same severity and due date: DISEASE > MATURITY > FERTILIZER", () => {
    const due = inHours(150);
    const f = alert({ category: "FERTILIZER", dueAt: due });
    const m = alert({ category: "MATURITY", dueAt: due });
    const d = alert({ category: "DISEASE", dueAt: due });
    expect([f, m, d].sort((a, b) => compareAlerts(a, b, now))).toEqual([d, m, f]);
  });
  it("alerts without due date go last within the same severity", () => {
    const noDue = alert({ severity: "LOW" });
    const due = alert({ severity: "LOW", dueAt: inHours(300) });
    expect([noDue, due].sort((a, b) => compareAlerts(a, b, now))).toEqual([due, noDue]);
  });
  it("actions: not done first, then by priority", () => {
    const actions = [
      { id: "x", done: true, priority: 1 },
      { id: "y", done: false, priority: 2 },
      { id: "z", done: false, priority: 1 },
    ];
    expect(sortActions(actions).map((a) => a.id)).toEqual(["z", "y", "x"]);
  });
});

describe("getConfidenceLabel (§6.7)", () => {
  it("automatic DISEASE from DRONE → Suspected", () => {
    expect(getConfidenceLabel({ category: "DISEASE", source: "DRONE", confidence: 0.78 })).toBe("Suspected · 78%");
  });
  it("automatic MATURITY → Estimate", () => {
    expect(getConfidenceLabel({ category: "MATURITY", source: "WEATHER", confidence: 0.85 })).toBe("Estimate · 85%");
  });
  it("MANUAL with null confidence → no label", () => {
    expect(getConfidenceLabel({ category: "DISEASE", source: "MANUAL", confidence: null })).toBeNull();
  });
});
