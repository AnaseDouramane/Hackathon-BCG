import { datasetDemoNow } from "@/lib/data";

/**
 * "Adesso" per tutte le regole (spec §6.2): DEMO_NOW se impostata, altrimenti
 * la data del dataset demo. Così urgenze e numeri non cambiano con il giorno della demo.
 */
export function getNow(): Date {
  const fromEnv = process.env.DEMO_NOW;
  if (fromEnv) {
    const parsed = new Date(fromEnv);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return datasetDemoNow;
}
