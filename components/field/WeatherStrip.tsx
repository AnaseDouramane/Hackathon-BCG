import { Card, CardTitle } from "@/components/ui/Card";
import type { WeatherDay } from "@/lib/contract/schemas";
import { formatShortDate, formatWeekday } from "@/lib/domain/format";

const HEAVY_RAIN_MM = 25;

// Compact full-width rain chart, meant to sit at the bottom of the field page.
export function WeatherStrip({ days }: { days: WeatherDay[] }) {
  const maxRain = Math.max(30, ...days.map((d) => d.rainMm));
  return (
    <Card className="p-3!">
      <CardTitle aside="forecast">Weather · 5 days</CardTitle>
      {days.length === 0 ? (
        <p className="text-sm text-muted">No data</p>
      ) : (
        <ul className="grid grid-cols-5 gap-3 text-center">
          {days.map((d) => {
            const heavy = d.rainMm >= HEAVY_RAIN_MM;
            return (
              <li key={d.date} className={`rounded-lg px-2 py-1 ${heavy ? "bg-fertilizer/10" : ""}`}>
                <p className="text-xs font-semibold text-ink">
                  {formatWeekday(d.date)} <span className="font-normal text-muted">{formatShortDate(d.date)}</span>
                </p>
                <div className="mx-auto mt-1 flex h-8 w-full max-w-24 items-end rounded bg-line/60">
                  <div
                    className={`w-full rounded ${heavy ? "bg-fertilizer" : "bg-fertilizer/50"}`}
                    style={{ height: `${Math.max(6, (d.rainMm / maxRain) * 100)}%` }}
                  />
                </div>
                <p className={`mt-1 text-sm tabular-nums ${heavy ? "font-bold text-fertilizer" : "font-semibold text-ink"}`}>
                  {d.rainMm} mm
                </p>
                <p className="text-[11px] text-muted tabular-nums">
                  {d.rainProbPct}% · {d.tempMinC}–{d.tempMaxC}°
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
