"use client";

import { type CropCode, CropCodeSchema } from "@/lib/contract/schemas";
import { titleCase } from "@/lib/domain/format";

export function CropFilter({
  value,
  available,
  onChange,
}: {
  value: CropCode | null;
  available: CropCode[];
  onChange: (crop: CropCode | null) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-muted">
      Crop
      <select
        value={value ?? ""}
        onChange={(e) => {
          const parsed = CropCodeSchema.safeParse(e.target.value);
          onChange(parsed.success ? parsed.data : null);
        }}
        className="min-h-11 rounded-xl border border-line bg-white px-3 text-base text-ink"
      >
        <option value="">All crops</option>
        {CropCodeSchema.options.map((code) => (
          <option key={code} value={code} disabled={!available.includes(code)}>
            {titleCase(code)}
          </option>
        ))}
      </select>
    </label>
  );
}
