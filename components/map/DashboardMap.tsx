"use client";

import { useState } from "react";
import type { FieldSummary } from "@/lib/contract/schemas";
import { FieldMapLazy } from "./FieldMapLazy";
import { type FilterKey, MapFilters } from "./MapFilters";
import { MapLegend } from "./MapLegend";

/** Mappa della dashboard con i filtri per categoria (solo lato client, nessuna nuova chiamata). */
export function DashboardMap({ fields, nowIso }: { fields: FieldSummary[]; nowIso: string }) {
  const [visible, setVisible] = useState<Record<FilterKey, boolean>>({
    DISEASE: true,
    FERTILIZER: true,
    MATURITY: true,
    OK: true,
  });

  const shown = fields.filter((f) =>
    f.categories.length === 0 ? visible.OK : f.categories.some((c) => visible[c]),
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <MapFilters visible={visible} onToggle={(key) => setVisible((v) => ({ ...v, [key]: !v[key] }))} />
      <div className="relative min-h-[420px] flex-1">
        <FieldMapLazy fields={shown} boundsFields={fields} nowIso={nowIso} className="h-full" />
        <MapLegend />
      </div>
    </div>
  );
}
