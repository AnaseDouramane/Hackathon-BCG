import type {
  SeedAction,
  SeedAlert,
  SeedCrop,
  SeedDroneCapture,
  SeedFarmer,
  SeedField,
  SeedPlanting,
  SeedSensorReading,
  SeedWeatherForecast,
} from "@/lib/contract/seed-schema";

/**
 * Tutto ciò che si sa di un campo, già unito con le sue relazioni.
 * È la forma che ogni repository (memoria o Prisma) deve restituire.
 */
export type FieldAggregate = {
  field: SeedField;
  farmer: SeedFarmer;
  /** Semina attiva con la sua coltura (al massimo una per campo). */
  planting: (SeedPlanting & { crop: SeedCrop }) | null;
  alerts: SeedAlert[];
  actions: SeedAction[];
  sensorReadings: SeedSensorReading[];
  weatherForecasts: SeedWeatherForecast[];
  droneCaptures: SeedDroneCapture[];
};

/** Il minimo che serve alle regole su un alert. */
export type AlertLike = Pick<SeedAlert, "id" | "category" | "severity" | "status" | "dueAt">;
