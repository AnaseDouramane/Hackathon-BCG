// Fase 1: legge data/seed.json. È il "back finto": zero configurazione.
import rawSeed from "@/data/seed.json";
import { type Seed, SeedSchema } from "@/lib/contract/seed-schema";
import type { FieldAggregate } from "@/lib/domain/types";
import type { Repository } from "./repository";

/** Unisce le tabelle del seed in un aggregato per campo. */
export function buildAggregates(seed: Seed): FieldAggregate[] {
  const farmers = new Map(seed.farmers.map((f) => [f.id, f]));
  const crops = new Map(seed.crops.map((c) => [c.id, c]));
  const byField = <T extends { fieldId: string }>(rows: T[]) => {
    const map = new Map<string, T[]>();
    for (const row of rows) map.set(row.fieldId, [...(map.get(row.fieldId) ?? []), row]);
    return map;
  };
  const plantings = byField(seed.plantings);
  const alerts = byField(seed.alerts);
  const actions = byField(seed.actions);
  const sensors = byField(seed.sensorReadings);
  const weather = byField(seed.weatherForecasts);
  const drone = byField(seed.droneCaptures);

  return seed.fields.map((field) => {
    const farmer = farmers.get(field.farmerId);
    if (!farmer) throw new Error(`seed.json: farmer ${field.farmerId} not found for field ${field.id}`);

    const active = (plantings.get(field.id) ?? []).filter((p) => p.status === "ACTIVE");
    if (active.length > 1) throw new Error(`seed.json: field ${field.id} has more than one ACTIVE planting`);
    const planting = active[0];
    const crop = planting ? crops.get(planting.cropId) : undefined;
    if (planting && !crop) throw new Error(`seed.json: crop ${planting.cropId} not found`);

    return {
      field,
      farmer,
      planting: planting && crop ? { ...planting, crop } : null,
      alerts: alerts.get(field.id) ?? [],
      actions: actions.get(field.id) ?? [],
      sensorReadings: sensors.get(field.id) ?? [],
      weatherForecasts: weather.get(field.id) ?? [],
      droneCaptures: drone.get(field.id) ?? [],
    };
  });
}

export const seed: Seed = SeedSchema.parse(rawSeed);
const aggregates = buildAggregates(seed);
const byId = new Map(aggregates.map((a) => [a.field.id, a]));

export const memoryRepository: Repository = {
  async listFieldAggregates() {
    return aggregates;
  },
  async getFieldAggregate(id) {
    return byId.get(id) ?? null;
  },
};
