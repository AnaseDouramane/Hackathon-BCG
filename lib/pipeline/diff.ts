// Cosa è cambiato tra due analisi: alert nuovi, risolti, aggravati e cambi di colore del campo.
import type { Category, Severity } from "@/lib/contract/schemas";
import type { Seed, SeedAlert } from "@/lib/contract/seed-schema";
import { getLampColors } from "@/lib/domain/lamp";
import type { AlertChange, FieldChange } from "./types";

const RANK: Record<Severity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function openByCategory(alerts: SeedAlert[]): Map<Category, SeedAlert> {
  const map = new Map<Category, SeedAlert>();
  for (const a of alerts) {
    if (a.status !== "OPEN") continue;
    const current = map.get(a.category);
    if (!current || RANK[a.severity] > RANK[current.severity]) map.set(a.category, a);
  }
  return map;
}

const groupByField = (alerts: SeedAlert[]) => {
  const map = new Map<string, SeedAlert[]>();
  for (const a of alerts) map.set(a.fieldId, [...(map.get(a.fieldId) ?? []), a]);
  return map;
};

const change = (a: SeedAlert, fromSeverity?: Severity): AlertChange => ({
  category: a.category,
  severity: a.severity,
  title: a.title,
  ...(fromSeverity ? { fromSeverity } : {}),
});

export function diffSeeds(before: Seed, after: Seed, now: Date): FieldChange[] {
  const beforeAlerts = groupByField(before.alerts);
  const afterAlerts = groupByField(after.alerts);
  const changes: FieldChange[] = [];

  for (const field of after.fields) {
    const prev = beforeAlerts.get(field.id) ?? [];
    const next = afterAlerts.get(field.id) ?? [];
    const prevByCat = openByCategory(prev);
    const nextByCat = openByCategory(next);

    const added = [...nextByCat].filter(([cat]) => !prevByCat.has(cat)).map(([, a]) => change(a));
    const resolved = [...prevByCat].filter(([cat]) => !nextByCat.has(cat)).map(([, a]) => change(a));
    const escalated = [...nextByCat].flatMap(([cat, a]) => {
      const old = prevByCat.get(cat);
      return old && RANK[a.severity] > RANK[old.severity] ? [change(a, old.severity)] : [];
    });
    const beforeColors = getLampColors(prev, now);
    const afterColors = getLampColors(next, now);
    const colorChanged = beforeColors.join() !== afterColors.join();

    if (colorChanged || added.length || resolved.length || escalated.length) {
      changes.push({ fieldId: field.id, code: field.code, name: field.name, before: beforeColors, after: afterColors, added, resolved, escalated });
    }
  }

  // prima i campi che peggiorano: nuovi problemi e aggravamenti
  return changes.sort((a, b) => b.added.length + b.escalated.length - (a.added.length + a.escalated.length));
}
