import type { Category, LampColor, Severity } from "@/lib/contract/schemas";
import type { CropHealthResult } from "@/lib/external/crophealth";

export type SourceName = "weather" | "isda" | "cropHealth" | "claude";

export type SourceStatus = {
  name: SourceName;
  /** ok = usata · partial = alcune chiamate fallite · error = non disponibile · skipped = nessuna chiave o nulla da fare */
  status: "ok" | "partial" | "error" | "skipped";
  detail?: string;
};

export type AlertChange = { category: Category; severity: Severity; title: string; fromSeverity?: Severity };

/** Cosa è cambiato in un campo rispetto all'analisi precedente. */
export type FieldChange = {
  fieldId: string;
  code: string;
  name: string;
  before: LampColor[];
  after: LampColor[];
  added: AlertChange[];
  resolved: AlertChange[];
  escalated: AlertChange[];
};

/** Una foto caricata dal campo, con quello che le API ci hanno visto. */
export type PhotoFinding = {
  url: string;
  uploadedAt: string;
  analysedAt: string;
  cropHealth: CropHealthResult | null;
  /** Descrizione di Claude di cosa mostra la foto (coltura, stadio, sintomi). */
  visualNotes: string;
};

/** Risultato di un giro di analisi: il seed ricalcolato più il diff e lo stato delle fonti. */
export type AnalysisSnapshot = {
  version: 1;
  createdAt: string;
  sources: SourceStatus[];
  changes: FieldChange[];
  /** Foto analizzate, per campo (le più recenti per ultime). */
  photos: Record<string, PhotoFinding[]>;
  /** Impronte delle evidenze per campo: Claude rivaluta solo i campi la cui impronta cambia. */
  fingerprints?: Record<string, string>;
  /** Stessa forma di data/seed.json (SeedSchema), con alert/azioni/meteo calcolati dalle API. */
  seed: unknown;
};
