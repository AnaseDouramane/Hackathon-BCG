// Statistiche della dashboard (spec §6.5).
import type { Stats } from "@/lib/contract/schemas";
import type { AlertLike } from "./types";
import { isUrgent, openAlerts } from "./urgency";

/** Un campo con più problemi viene contato in più statistiche. */
export function computeStats(fieldsAlerts: AlertLike[][], now: Date): Stats {
  const stats: Stats = {
    urgent: 0,
    disease: 0,
    fertilizer: 0,
    maturity: 0,
    ok: 0,
    totalFields: fieldsAlerts.length,
    asOf: now.toISOString(),
  };

  for (const alerts of fieldsAlerts) {
    const open = openAlerts(alerts);
    if (open.length === 0) {
      stats.ok++;
      continue;
    }
    if (open.some((a) => isUrgent(a, now))) stats.urgent++;
    if (open.some((a) => a.category === "DISEASE")) stats.disease++;
    if (open.some((a) => a.category === "FERTILIZER")) stats.fertilizer++;
    if (open.some((a) => a.category === "MATURITY")) stats.maturity++;
  }

  return stats;
}
