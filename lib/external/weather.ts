// Port TS di tools/python/weather.py (OpenWeather), solo la previsione a 5 giorni / 3 ore.
// Una chiamata per stazione meteo di zona (8 in tutto), aggregata in giorni.
import { z } from "zod";

const BASE_URL = "https://api.openweathermap.org/data/2.5";

export const isWeatherEnabled = () => Boolean(process.env.OPENWEATHER_API_KEY);

const ForecastSchema = z.object({
  city: z.object({ timezone: z.number() }),
  list: z.array(
    z.object({
      dt: z.number(),
      main: z.object({ temp_min: z.number(), temp_max: z.number(), humidity: z.number() }),
      pop: z.number().optional(),
      rain: z.object({ "3h": z.number().optional() }).nullish(),
    }),
  ),
});

export type DailyForecast = {
  /** Giorno locale della stazione, YYYY-MM-DD. */
  date: string;
  tempMinC: number;
  tempMaxC: number;
  rainMm: number;
  rainProbPct: number;
  humidityPct: number;
};

/** Raggruppa gli step da 3 ore per giorno locale (timezone in secondi da UTC). */
export function toDailyForecast(raw: unknown): DailyForecast[] {
  const { city, list } = ForecastSchema.parse(raw);
  const days = new Map<string, (typeof list)[number][]>();
  for (const step of list) {
    const date = new Date((step.dt + city.timezone) * 1000).toISOString().slice(0, 10);
    days.set(date, [...(days.get(date) ?? []), step]);
  }
  return [...days].map(([date, steps]) => ({
    date,
    tempMinC: Math.round(Math.min(...steps.map((s) => s.main.temp_min))),
    tempMaxC: Math.round(Math.max(...steps.map((s) => s.main.temp_max))),
    rainMm: Math.round(steps.reduce((sum, s) => sum + (s.rain?.["3h"] ?? 0), 0)),
    rainProbPct: Math.round(Math.max(...steps.map((s) => s.pop ?? 0)) * 100),
    humidityPct: Math.round(steps.reduce((sum, s) => sum + s.main.humidity, 0) / steps.length),
  }));
}

export async function getDailyForecast(lat: number, lon: number): Promise<DailyForecast[]> {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    units: "metric",
    appid: process.env.OPENWEATHER_API_KEY ?? "",
  });
  const res = await fetch(`${BASE_URL}/forecast?${query}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`OpenWeather forecast failed (${res.status}): ${await res.text()}`);
  return toDailyForecast(await res.json());
}
