"use client";

import { useState } from "react";
import { IssueRow } from "@/components/issues/IssueRow";
import { FieldMapLazy } from "@/components/map/FieldMapLazy";
import type { FieldSummary } from "@/lib/contract/schemas";

/** Elenco di tutti i campi di una coltura + mini-mappa; passando sopra una riga il campo si evidenzia. */
export function CropFieldsView({ fields, nowIso }: { fields: FieldSummary[]; nowIso: string }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const now = new Date(nowIso);

  if (fields.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-8 text-center text-ink">No fields with this crop.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
      <ol className="space-y-3">
        {fields.map((field) => (
          <IssueRow key={field.id} field={field} now={now} highlighted={hovered === field.id} onHover={setHovered} />
        ))}
      </ol>
      <div className="h-[420px] lg:sticky lg:top-0">
        <FieldMapLazy fields={fields} highlightId={hovered} onHover={setHovered} nowIso={nowIso} className="h-full" />
      </div>
    </div>
  );
}
