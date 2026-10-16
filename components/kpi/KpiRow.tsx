import type { Stats } from "@/lib/contract/schemas";
import { URGENT_WINDOW_HOURS } from "@/lib/domain/urgency";
import { KpiCard } from "./KpiCard";

const fields = (n: number) => `${n === 1 ? "field" : "fields"} affected`;

/** Ordine fisso: Urgent, Disease, Fertilizer, Maturity (spec §8.1). */
export function KpiRow({ stats }: { stats: Stats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiCard category="URGENT" value={stats.urgent} caption={`act within ${URGENT_WINDOW_HOURS}h`} href="/issues/urgent" />
      <KpiCard category="DISEASE" value={stats.disease} caption={fields(stats.disease)} href="/issues/disease" />
      <KpiCard category="FERTILIZER" value={stats.fertilizer} caption={fields(stats.fertilizer)} href="/issues/fertilizer" />
      <KpiCard category="MATURITY" value={stats.maturity} caption={fields(stats.maturity)} href="/issues/maturity" />
    </div>
  );
}
