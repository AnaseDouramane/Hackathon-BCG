// Palette del dominio (spec §6.1). I componenti usano i token Tailwind definiti
// in app/globals.css con gli stessi valori; qui servono a mappa e lampione.
import type { Category, LampColor } from "@/lib/contract/schemas";

export const LAMP_HEX: Record<LampColor, string> = {
  RED: "#E53935",
  PURPLE: "#8E44AD",
  BLUE: "#2E86DE",
  AMBER: "#F5A623",
  GREEN: "#43A047",
};

export const CATEGORY_LAMP_COLOR: Record<Category, LampColor> = {
  DISEASE: "PURPLE",
  FERTILIZER: "BLUE",
  MATURITY: "AMBER",
};

/** Ordine fisso dei colori nel lampione: DISEASE → FERTILIZER → MATURITY. */
export const CATEGORY_LAMP_ORDER: readonly Category[] = ["DISEASE", "FERTILIZER", "MATURITY"];

export const CATEGORY_LABEL: Record<Category, string> = {
  DISEASE: "Disease",
  FERTILIZER: "Needs (fertilizers & water)",
  MATURITY: "Maturity",
};

export const LAMP_COLOR_LABEL: Record<LampColor, string> = {
  RED: "Red",
  PURPLE: "Purple",
  BLUE: "Blue",
  AMBER: "Amber",
  GREEN: "Green",
};
