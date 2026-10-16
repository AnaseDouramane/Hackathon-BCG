// Il contratto API (spec §7). Modifiche solo con review di #1 e #4.
import { z } from "zod";

// ─── Enum ────────────────────────────────────────────────────────────────

export const CategorySchema = z.enum(["DISEASE", "FERTILIZER", "MATURITY"]);
export const SeveritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const AlertSourceSchema = z.enum(["SENSOR", "DRONE", "WEATHER", "MANUAL"]);
export const AlertStatusSchema = z.enum(["OPEN", "RESOLVED"]);
export const LampColorSchema = z.enum(["RED", "PURPLE", "BLUE", "AMBER", "GREEN"]);
export const CropCodeSchema = z.enum(["MAIZE", "SOYBEAN", "BEANS", "TOBACCO", "GROUNDNUT"]);
export const GrowthStageSchema = z.enum(["EMERGENCE", "VEGETATIVE", "FLOWERING", "FRUITING", "MATURITY"]);
export const PlantingStatusSchema = z.enum(["ACTIVE", "HARVESTED"]);

/** Valori di categoria usati nell'URL e nei parametri di query (minuscoli). */
export const CategoryFilterSchema = z.enum(["urgent", "disease", "fertilizer", "maturity"]);

export type Category = z.infer<typeof CategorySchema>;
export type Severity = z.infer<typeof SeveritySchema>;
export type AlertSource = z.infer<typeof AlertSourceSchema>;
export type AlertStatus = z.infer<typeof AlertStatusSchema>;
export type LampColor = z.infer<typeof LampColorSchema>;
export type CropCode = z.infer<typeof CropCodeSchema>;
export type GrowthStage = z.infer<typeof GrowthStageSchema>;
export type CategoryFilter = z.infer<typeof CategoryFilterSchema>;

// ─── Blocchi comuni ──────────────────────────────────────────────────────

const IsoDateTime = z.iso.datetime();
const IsoDate = z.iso.date();

/** GeoJSON Polygon: coordinate [lng, lat]. */
export const PolygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
});
export type Polygon = z.infer<typeof PolygonSchema>;

export const CropRefSchema = z.object({ code: CropCodeSchema, name: z.string() });

export const AlertDtoSchema = z.object({
  id: z.string(),
  category: CategorySchema,
  severity: SeveritySchema,
  title: z.string(),
  description: z.string(),
  source: AlertSourceSchema,
  detectedAt: IsoDateTime,
  dueAt: IsoDateTime.nullable(),
  /** 0–1 per alert automatici, null se confermato da Felix (spec §6.7). */
  confidence: z.number().min(0).max(1).nullable(),
  isUrgent: z.boolean(),
});
export type AlertDto = z.infer<typeof AlertDtoSchema>;

export const TopAlertSchema = AlertDtoSchema.pick({
  id: true,
  category: true,
  severity: true,
  title: true,
  source: true,
  dueAt: true,
  confidence: true,
  isUrgent: true,
});
export type TopAlert = z.infer<typeof TopAlertSchema>;

// ─── GET /api/stats ──────────────────────────────────────────────────────

export const StatsSchema = z.object({
  urgent: z.number().int(),
  disease: z.number().int(),
  fertilizer: z.number().int(),
  maturity: z.number().int(),
  ok: z.number().int(),
  totalFields: z.number().int(),
  asOf: IsoDateTime,
});
export type Stats = z.infer<typeof StatsSchema>;

// ─── GET /api/fields ─────────────────────────────────────────────────────

export const FieldSummarySchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  crop: CropRefSchema.nullable(),
  areaHa: z.number(),
  farmerName: z.string(),
  village: z.string(),
  boundary: PolygonSchema,
  centroid: z.object({ lat: z.number(), lng: z.number() }),
  categories: z.array(CategorySchema),
  isUrgent: z.boolean(),
  lampColors: z.array(LampColorSchema).min(1),
  openAlertsCount: z.number().int(),
  /** L'alert più prioritario tra quelli che rispettano il filtro `category` (o in assoluto). */
  topAlert: TopAlertSchema.nullable(),
});
export type FieldSummary = z.infer<typeof FieldSummarySchema>;

export const FieldListQuerySchema = z.object({
  category: CategoryFilterSchema.optional(),
  crop: CropCodeSchema.optional(),
});
export type FieldListQuery = z.infer<typeof FieldListQuerySchema>;

// ─── GET /api/fields/:id ─────────────────────────────────────────────────

export const ActionDtoSchema = z.object({
  id: z.string(),
  alertId: z.string(),
  priority: z.number().int(),
  title: z.string(),
  why: z.string(),
  dueAt: IsoDateTime.nullable(),
  category: CategorySchema,
  source: AlertSourceSchema,
  confidence: z.number().min(0).max(1).nullable(),
  isUrgent: z.boolean(),
  done: z.boolean(),
});
export type ActionDto = z.infer<typeof ActionDtoSchema>;

export const SensorReadingDtoSchema = z.object({
  measuredAt: IsoDateTime,
  soilMoisturePct: z.number().nullable(),
  soilTempC: z.number().nullable(),
  ph: z.number().nullable(),
  nPpm: z.number().nullable(),
  pPpm: z.number().nullable(),
  kPpm: z.number().nullable(),
});
export type SensorReadingDto = z.infer<typeof SensorReadingDtoSchema>;

export const WeatherDaySchema = z.object({
  date: IsoDate,
  tempMinC: z.number(),
  tempMaxC: z.number(),
  rainMm: z.number(),
  rainProbPct: z.number().int(),
  humidityPct: z.number().int(),
});
export type WeatherDay = z.infer<typeof WeatherDaySchema>;

export const DroneCaptureDtoSchema = z.object({
  capturedAt: IsoDateTime,
  imageUrl: z.string(),
  ndviMean: z.number().nullable(),
  findings: z.string().nullable(),
});
export type DroneCaptureDto = z.infer<typeof DroneCaptureDtoSchema>;

export const FieldDetailSchema = FieldSummarySchema.extend({
  farmer: z.object({ name: z.string(), phone: z.string(), village: z.string() }),
  planting: z
    .object({
      crop: CropRefSchema,
      plantedAt: IsoDate,
      expectedHarvestStart: IsoDate,
      expectedHarvestEnd: IsoDate,
      growthStage: GrowthStageSchema,
    })
    .nullable(),
  alerts: z.array(AlertDtoSchema),
  actions: z.array(ActionDtoSchema),
  latestSensorReading: SensorReadingDtoSchema.nullable(),
  weather: z.array(WeatherDaySchema),
  latestDroneCapture: DroneCaptureDtoSchema.nullable(),
});
export type FieldDetail = z.infer<typeof FieldDetailSchema>;

// ─── Errori ──────────────────────────────────────────────────────────────

export const ApiErrorSchema = z.object({
  error: z.enum(["INVALID_QUERY", "FIELD_NOT_FOUND", "INTERNAL_ERROR"]),
  message: z.string(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
