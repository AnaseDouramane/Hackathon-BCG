// Le sole funzioni che pagine e API route usano per leggere i dati (spec §3, §5).
import {
  type CategoryFilter,
  type CropCode,
  type FieldDetail,
  FieldDetailSchema,
  type FieldSummary,
  FieldSummarySchema,
  type Stats,
  StatsSchema,
} from "@/lib/contract/schemas";
import { getRepository } from "@/lib/data";
import { alertsMatching, toFieldDetail, toFieldSummary } from "@/lib/domain/build";
import { sortAlerts, sortByTopAlert } from "@/lib/domain/priority";
import { computeStats } from "@/lib/domain/stats";
import { getNow } from "@/lib/now";

export async function getStats(): Promise<Stats> {
  const aggregates = await getRepository().listFieldAggregates();
  return StatsSchema.parse(computeStats(aggregates.map((a) => a.alerts), getNow()));
}

/** Campi ordinati per priorità (spec §6.4), filtrati per categoria e coltura. */
export async function listFields(filter: { category?: CategoryFilter; crop?: CropCode } = {}): Promise<FieldSummary[]> {
  const now = getNow();
  const aggregates = await getRepository().listFieldAggregates();

  const matching = aggregates.filter((agg) => {
    if (filter.crop && agg.planting?.crop.code !== filter.crop) return false;
    if (filter.category && alertsMatching(agg.alerts, filter.category, now).length === 0) return false;
    return true;
  });

  const sorted = sortByTopAlert(
    matching,
    (agg) => sortAlerts(alertsMatching(agg.alerts, filter.category, now), now)[0] ?? null,
    (agg) => agg.field.code,
    now,
  );

  return FieldSummarySchema.array().parse(sorted.map((agg) => toFieldSummary(agg, now, filter.category)));
}

export async function getFieldDetail(id: string): Promise<FieldDetail | null> {
  const agg = await getRepository().getFieldAggregate(id);
  return agg ? FieldDetailSchema.parse(toFieldDetail(agg, getNow())) : null;
}

export async function listFieldIds(): Promise<string[]> {
  const aggregates = await getRepository().listFieldAggregates();
  return aggregates.map((a) => a.field.id);
}

/** Dati dell'header: "adesso" e meteo medio dell'area per oggi. */
export async function getHeaderInfo(): Promise<{ now: string; tempMaxC: number | null; rainMm: number | null }> {
  const now = getNow();
  const today = now.toISOString().slice(0, 10);
  const aggregates = await getRepository().listFieldAggregates();
  const todays = aggregates.flatMap((a) => a.weatherForecasts).filter((w) => w.date.toISOString().slice(0, 10) === today);
  const avg = (values: number[]) => (values.length ? values.reduce((s, v) => s + v, 0) / values.length : null);
  const tempMax = avg(todays.map((w) => w.tempMaxC));
  const rain = avg(todays.map((w) => w.rainMm));
  return {
    now: now.toISOString(),
    tempMaxC: tempMax === null ? null : Math.round(tempMax),
    rainMm: rain === null ? null : Math.round(rain),
  };
}
