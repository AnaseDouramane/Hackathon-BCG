"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { FieldMapLazy } from "@/components/map/FieldMapLazy";
import { type CropCode, CropCodeSchema, type FieldSummary } from "@/lib/contract/schemas";
import { CropFilter } from "./CropFilter";
import { IssueRow } from "./IssueRow";

/** Lista + mini-mappa. Il filtro coltura vive nell'URL (?crop=MAIZE) così la vista si può condividere. */
export function IssuesView({ fields, nowIso }: { fields: FieldSummary[]; nowIso: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hovered, setHovered] = useState<string | null>(null);

  const parsedCrop = CropCodeSchema.safeParse(searchParams.get("crop"));
  const crop: CropCode | null = parsedCrop.success ? parsedCrop.data : null;
  const available = [...new Set(fields.flatMap((f) => (f.crop ? [f.crop.code] : [])))];
  const shown = crop ? fields.filter((f) => f.crop?.code === crop) : fields;
  const now = new Date(nowIso);

  const setCrop = (next: CropCode | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("crop", next);
    else params.delete("crop");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Showing {shown.length} of {fields.length} · ordered by priority
        </p>
        <CropFilter value={crop} available={available} onChange={setCrop} />
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-8 text-center text-ink">No fields need attention 🎉</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_380px]">
          <ol className="space-y-3">
            {shown.map((field) => (
              <IssueRow key={field.id} field={field} now={now} highlighted={hovered === field.id} onHover={setHovered} />
            ))}
          </ol>
          <div className="h-[420px] lg:sticky lg:top-20">
            <FieldMapLazy fields={shown} highlightId={hovered} onHover={setHovered} nowIso={nowIso} className="h-full" />
          </div>
        </div>
      )}
    </>
  );
}
