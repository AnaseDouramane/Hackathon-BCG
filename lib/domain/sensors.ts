// Soglie indicative per evidenziare i valori dei sensori nella UI.
// Valori semplificati, da validare con un agronomo (#5).
import type { SensorReadingDto } from "@/lib/contract/schemas";

export type SensorKey = Exclude<keyof SensorReadingDto, "measuredAt">;

export const SENSOR_META: Record<
  SensorKey,
  { label: string; unit: string; decimals: number; min?: number; max?: number }
> = {
  soilMoisturePct: { label: "Soil moisture", unit: "%", decimals: 0, min: 20, max: 80 },
  soilTempC: { label: "Soil temp", unit: "°C", decimals: 1, min: 15, max: 30 },
  ph: { label: "pH", unit: "", decimals: 1, min: 5.5, max: 7.0 },
  nPpm: { label: "Nitrogen (N)", unit: "ppm", decimals: 0, min: 15 },
  pPpm: { label: "Phosphorus (P)", unit: "ppm", decimals: 0, min: 10 },
  kPpm: { label: "Potassium (K)", unit: "ppm", decimals: 0, min: 80 },
};

export function formatSensorValue(key: SensorKey, value: number | null): string {
  if (value === null) return "—";
  const { unit, decimals } = SENSOR_META[key];
  return `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
}

export type SensorStatus = "low" | "high" | "ok";

export function getSensorStatus(key: SensorKey, value: number | null): SensorStatus {
  if (value === null) return "ok";
  const { min, max } = SENSOR_META[key];
  if (min !== undefined && value < min) return "low";
  if (max !== undefined && value > max) return "high";
  return "ok";
}
