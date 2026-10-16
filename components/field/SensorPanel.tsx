import { Card, CardTitle } from "@/components/ui/Card";
import type { SensorReadingDto } from "@/lib/contract/schemas";
import { formatShortDate, formatTime } from "@/lib/domain/format";
import { formatSensorValue, getSensorStatus, SENSOR_META, type SensorKey } from "@/lib/domain/sensors";

const KEYS: SensorKey[] = ["soilMoisturePct", "soilTempC", "ph", "nPpm", "pPpm", "kPpm"];

export function SensorPanel({ reading }: { reading: SensorReadingDto | null }) {
  return (
    <Card>
      <CardTitle aside={reading ? `${formatShortDate(reading.measuredAt)} ${formatTime(reading.measuredAt)}` : undefined}>
        Soil sensors
      </CardTitle>
      {!reading ? (
        <p className="text-sm text-muted">No data</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {KEYS.map((key) => {
            const value = reading[key];
            const status = getSensorStatus(key, value);
            const { label } = SENSOR_META[key];
            return (
              <div key={key}>
                <dt className="text-xs text-muted">{label}</dt>
                <dd className={`text-base font-semibold tabular-nums ${status === "ok" ? "text-ink" : "text-maturity"}`}>
                  {formatSensorValue(key, value)}
                  {status !== "ok" && <span className="ml-1 text-xs font-medium uppercase">{status}</span>}
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <p className="mt-3 text-xs text-muted">Sensors detect soil conditions, not diseases.</p>
    </Card>
  );
}
