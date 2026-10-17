// Classi Tailwind e icone per ogni categoria (incluse Urgent e OK).
// Le classi sono scritte per intero perché Tailwind le trovi.
import { Bug, CircleCheck, FlaskConical, type LucideIcon, TriangleAlert, Wheat } from "lucide-react";
import type { Category, CategoryFilter } from "@/lib/contract/schemas";

export type CategoryKey = Category | "URGENT" | "OK";

export const CATEGORY_UI: Record<
  CategoryKey,
  { label: string; Icon: LucideIcon; text: string; bg: string; bgSoft: string; border: string }
> = {
  URGENT: {
    label: "Urgent",
    Icon: TriangleAlert,
    text: "text-urgent",
    bg: "bg-urgent",
    bgSoft: "bg-urgent/10",
    border: "border-urgent",
  },
  DISEASE: {
    label: "Disease",
    Icon: Bug,
    text: "text-disease",
    bg: "bg-disease",
    bgSoft: "bg-disease/10",
    border: "border-disease",
  },
  FERTILIZER: {
    label: "Fertilizer",
    Icon: FlaskConical,
    text: "text-fertilizer",
    bg: "bg-fertilizer",
    bgSoft: "bg-fertilizer/10",
    border: "border-fertilizer",
  },
  MATURITY: {
    label: "Maturity",
    Icon: Wheat,
    text: "text-maturity",
    bg: "bg-maturity",
    bgSoft: "bg-maturity/15",
    border: "border-maturity",
  },
  OK: { label: "OK", Icon: CircleCheck, text: "text-ok", bg: "bg-ok", bgSoft: "bg-ok/10", border: "border-ok" },
};

export const FILTER_TO_KEY: Record<CategoryFilter, CategoryKey> = {
  urgent: "URGENT",
  disease: "DISEASE",
  fertilizer: "FERTILIZER",
  maturity: "MATURITY",
};
