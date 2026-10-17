// Il "db" dei campi: data/kasungu/*.csv letti a runtime (in next.config.ts sono inclusi nel deploy).
// Stessi file e stesse colonne usati da tools/python/risk.py (build_field_contexts).
import fs from "node:fs";
import path from "node:path";

export type CsvRow = Record<string, string>;

const DB_DIR = path.join(process.cwd(), "data", "kasungu");

function readCsv(file: string): CsvRow[] {
  const [header, ...rows] = fs.readFileSync(path.join(DB_DIR, file), "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map((line) => Object.fromEntries(line.split(",").map((v, i) => [keys[i], v])));
}

export type KasunguDb = {
  fields: CsvRow[];
  zones: Map<string, CsvRow>;
  gateways: Map<string, CsvRow>;
};

let db: KasunguDb | null = null;

export function loadKasunguDb(): KasunguDb {
  db ??= {
    fields: readCsv("kasungu_fields.csv"),
    zones: new Map(readCsv("kasungu_zones.csv").map((z) => [z.zone_id, z])),
    gateways: new Map(readCsv("kasungu_gateways.csv").map((g) => [g.gateway_id, g])),
  };
  return db;
}

/** Colonne statiche passate a Claude: niente nomi di persone (come in risk.py). */
export const STATIC_FIELD_KEYS = [
  "field_id",
  "field_name",
  "crop",
  "lat",
  "lon",
  "area_ha",
  "zone_id",
  "zone_code",
  "weather_station_id",
  "gateway_id",
  "soil_node_id",
  "shared_water_channel",
  "neighbours",
] as const;
