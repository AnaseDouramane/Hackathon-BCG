import { KpiRow } from "@/components/kpi/KpiRow";
import { TodayPriorities } from "@/components/kpi/TodayPriorities";
import { DashboardMap } from "@/components/map/DashboardMap";
import { getNow } from "@/lib/now";
import { getStats, listFields } from "@/lib/services/fields";

export default async function DashboardPage() {
  const [stats, fields] = await Promise.all([getStats(), listFields()]);
  const now = getNow();

  return (
    <main className="flex flex-col gap-4">
      <h1 className="sr-only">Dashboard</h1>
      <KpiRow stats={stats} />
      <div className="grid h-[calc(100dvh-14rem)] min-h-[520px] grid-cols-1 gap-4 md:grid-cols-[1fr_320px]">
        <DashboardMap fields={fields} nowIso={now.toISOString()} />
        <TodayPriorities fields={fields} now={now} />
      </div>
    </main>
  );
}
