// Rete di sicurezza per le foto: se crop.health trova un problema e Claude non ne ha fatto un alert,
// l'alert si crea comunque dal risultato di crop.health (stesso formato di risk.py).
import type { CropHealthResult } from "@/lib/external/crophealth";
import type { RiskAlert, RiskResult } from "@/lib/external/risk";

const MIN_PROBABILITY = 0.5;

export function photoIssueType(name: string): RiskAlert["type"] {
  if (/deficien|nutrient|nitrogen|phosph|potass|chlorosis/i.test(name)) return "Fertilizer";
  if (/ripe|matur|harvest/i.test(name)) return "Maturity";
  return "Disease";
}

const NEXT_STEP: Record<RiskAlert["type"], { title: string; why: string }> = {
  Fertilizer: { title: "Plan a fertilizer top-dressing with the agro-dealer", why: "A nutrient deficiency limits growth and yield if it is not corrected." },
  Disease: { title: "Ask the agro-dealer for a recommended treatment", why: "Treating early stops the problem from spreading to the rest of the field." },
  Maturity: { title: "Plan the harvest", why: "Harvesting on time avoids losses in the field." },
  Urgent: { title: "Act today", why: "The problem needs immediate attention." },
};

/** L'alert che crop.health giustifica da solo (il suggerimento più probabile che non sia "healthy"). */
export function cropHealthAlert(results: (CropHealthResult | null)[]): RiskAlert | null {
  const top = results
    .flatMap((r) => r?.diseases ?? [])
    .filter((d) => !/^healthy$/i.test(d.name) && d.probability >= MIN_PROBABILITY)
    .sort((a, b) => b.probability - a.probability)[0];
  if (!top) return null;
  const type = photoIssueType(top.name);
  const pct = Math.round(top.probability * 100);
  return {
    type,
    severity: top.probability >= 0.85 ? "high" : top.probability >= 0.65 ? "moderate" : "low",
    title: `Suspected ${top.name} (photo)`,
    evidence: `crop.health identified ${top.name} (${pct}%) on the photo uploaded from this field.`,
    rationale: "Raised from the photo identification: check the plant in the field to confirm.",
    source: "MANUAL",
    confidence: top.probability,
    actions: [
      { title: "Check 10 plants for the same symptoms", why: "Confirm the photo finding on the ground before acting.", due_in_days: 1 },
      { ...NEXT_STEP[type], due_in_days: 3 },
    ],
  };
}

/** Aggiunge l'alert della foto al risultato di Claude, se Claude non ne ha già uno dello stesso tipo. */
export function ensurePhotoIssue(result: RiskResult, alert: RiskAlert | null): RiskResult {
  if (!alert || result.alerts.some((a) => a.type === alert.type)) return result;
  return {
    ...result,
    flags: [...new Set([...result.flags, alert.type])],
    severity: result.severity === "none" ? alert.severity : result.severity,
    alerts: [...result.alerts, alert],
  };
}
