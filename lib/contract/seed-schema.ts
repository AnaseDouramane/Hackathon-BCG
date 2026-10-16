// Forma di data/seed.json: stessa forma delle tabelle del DB (docs/database.md §3).
import { z } from "zod";
import {
  AlertSourceSchema,
  AlertStatusSchema,
  CategorySchema,
  CropCodeSchema,
  GrowthStageSchema,
  PlantingStatusSchema,
  PolygonSchema,
  SeveritySchema,
} from "./schemas";

const DateTime = z.coerce.date();

export const SeedFarmerSchema = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  village: z.string(),
});

export const SeedCropSchema = z.object({
  id: z.string(),
  code: CropCodeSchema,
  name: z.string(),
  cycleDays: z.number().int(),
});

export const SeedFieldSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  farmerId: z.string(),
  areaHa: z.number(),
  boundary: PolygonSchema,
  centroidLat: z.number(),
  centroidLng: z.number(),
});

export const SeedPlantingSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  cropId: z.string(),
  plantedAt: DateTime,
  expectedHarvestStart: DateTime,
  expectedHarvestEnd: DateTime,
  growthStage: GrowthStageSchema,
  status: PlantingStatusSchema,
});

export const SeedAlertSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  plantingId: z.string().nullable(),
  category: CategorySchema,
  severity: SeveritySchema,
  title: z.string(),
  description: z.string(),
  source: AlertSourceSchema,
  confidence: z.number().min(0).max(1).nullable(),
  detectedAt: DateTime,
  dueAt: DateTime.nullable(),
  status: AlertStatusSchema,
  resolvedAt: DateTime.nullable(),
});

export const SeedActionSchema = z.object({
  id: z.string(),
  alertId: z.string(),
  fieldId: z.string(),
  priority: z.number().int().min(1),
  title: z.string(),
  why: z.string(),
  dueAt: DateTime.nullable(),
  done: z.boolean(),
  doneAt: DateTime.nullable(),
});

export const SeedSensorReadingSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  sensorId: z.string(),
  measuredAt: DateTime,
  soilMoisturePct: z.number().nullable(),
  soilTempC: z.number().nullable(),
  ph: z.number().nullable(),
  nPpm: z.number().nullable(),
  pPpm: z.number().nullable(),
  kPpm: z.number().nullable(),
});

export const SeedWeatherForecastSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  date: DateTime,
  tempMinC: z.number(),
  tempMaxC: z.number(),
  rainMm: z.number(),
  rainProbPct: z.number().int(),
  humidityPct: z.number().int(),
});

export const SeedDroneCaptureSchema = z.object({
  id: z.string(),
  fieldId: z.string(),
  capturedAt: DateTime,
  imageUrl: z.string(),
  ndviMean: z.number().nullable(),
  findings: z.string().nullable(),
});

export const SeedSchema = z.object({
  demoNow: DateTime,
  farmers: z.array(SeedFarmerSchema),
  crops: z.array(SeedCropSchema),
  fields: z.array(SeedFieldSchema),
  plantings: z.array(SeedPlantingSchema),
  alerts: z.array(SeedAlertSchema),
  actions: z.array(SeedActionSchema),
  sensorReadings: z.array(SeedSensorReadingSchema),
  weatherForecasts: z.array(SeedWeatherForecastSchema),
  droneCaptures: z.array(SeedDroneCaptureSchema),
});

export type Seed = z.infer<typeof SeedSchema>;
export type SeedFarmer = z.infer<typeof SeedFarmerSchema>;
export type SeedCrop = z.infer<typeof SeedCropSchema>;
export type SeedField = z.infer<typeof SeedFieldSchema>;
export type SeedPlanting = z.infer<typeof SeedPlantingSchema>;
export type SeedAlert = z.infer<typeof SeedAlertSchema>;
export type SeedAction = z.infer<typeof SeedActionSchema>;
export type SeedSensorReading = z.infer<typeof SeedSensorReadingSchema>;
export type SeedWeatherForecast = z.infer<typeof SeedWeatherForecastSchema>;
export type SeedDroneCapture = z.infer<typeof SeedDroneCaptureSchema>;
