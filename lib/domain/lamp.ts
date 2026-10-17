// Colore del lampione e del poligono sulla mappa (spec §6.3).
import type { LampColor } from "@/lib/contract/schemas";
import { CATEGORY_LAMP_COLOR, CATEGORY_LAMP_ORDER } from "./colors";
import type { AlertLike } from "./types";
import { isUrgent, openAlerts } from "./urgency";

/**
 * - almeno un alert urgente → ["RED"] (fisso)
 * - uno o più tipi di problema → i colori delle categorie, in ordine fisso
 * - nessun alert aperto → ["GREEN"]
 */
export function getLampColors(alerts: AlertLike[], now: Date): LampColor[] {
  const open = openAlerts(alerts);
  if (open.some((a) => isUrgent(a, now))) return ["RED"];

  const present = new Set(open.map((a) => a.category));
  const colors = CATEGORY_LAMP_ORDER.filter((c) => present.has(c)).map((c) => CATEGORY_LAMP_COLOR[c]);
  return colors.length > 0 ? colors : ["GREEN"];
}
