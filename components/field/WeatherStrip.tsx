import { Card, CardTitle } from "@/components/ui/Card";
import type { WeatherDay } from "@/lib/contract/schemas";
import { formatShortDate, formatWeekday } from "@/lib/domain/format";

const HEAVY_RAIN_MM = 25;

export function WeatherStrip({ days }: { days: WeatherDay[] }) {
  const maxRain = Math.max(30, ...days.map((d) => d.rainMm));
  return (
    <Card>
      <CardTitle aside="forecast">Weather · 5 days</CardTitle>
      {days.length === 0 ? (
        <p className="text-sm text-muted">No data</p>
      ) : (
        <ul className="grid grid-cols-5 gap-2 text-center">
          {days.map((d) => {
            const heavy = d.rainMm >= HEAVY_RAIN_MM;
            return (
              <li key={d.date} className={`rounded-xl px-1 py-2 ${heavy ? "bg-fertilizer/10" : ""}`}>
                <p className="text-sm font-semibold text-ink">{formatWeekday(d.date)}</p>
                <p className="text-[11px] text-muted">{formatShortDate(d.date)}</p>
                <div className="mx-auto mt-2 flex h-14 w-5 items-end rounded bg-line/60">
                  <div
                    className={`w-full rounded ${heavy ? "bg-fertilizer" : "bg-fertilizer/50"}`}
                    style={{ height: `${Math.max(4, (d.rainMm / maxRain) * 100)}%` }}
                  />
                </div>
                <p className={`mt-1 text-sm tabular-nums ${heavy ? "font-bold text-fertilizer" : "text-ink"}`}>
                  {d.rainMm} mm
                </p>
                <p className="text-[11px] text-muted">{d.rainProbPct}%</p>
                <p className="text-xs text-muted tabular-nums">
                  {d.tempMinC}–{d.tempMaxC}°
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
