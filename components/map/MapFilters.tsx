"use client";

import { Check } from "lucide-react";
import { CATEGORY_UI } from "@/components/ui/category";

export type FilterKey = "DISEASE" | "FERTILIZER" | "MATURITY" | "OK";
export const FILTER_KEYS: FilterKey[] = ["DISEASE", "FERTILIZER", "MATURITY", "OK"];

export function MapFilters({
  visible,
  onToggle,
}: {
  visible: Record<FilterKey, boolean>;
  onToggle: (key: FilterKey) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Show fields by category">
      <span className="text-xs font-semibold tracking-wider text-muted uppercase">Show</span>
      {FILTER_KEYS.map((key) => {
        const { label, Icon, text, border, bgSoft } = CATEGORY_UI[key];
        const on = visible[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(key)}
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
              on ? `${border} ${bgSoft} text-ink` : "border-line bg-white text-muted line-through"
            }`}
          >
            {on ? <Check size={14} className={text} aria-hidden /> : <Icon size={14} aria-hidden />}
            {label}
          </button>
        );
      })}
    </div>
  );
}
