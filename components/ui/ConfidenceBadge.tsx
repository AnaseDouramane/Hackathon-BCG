import { ScanSearch } from "lucide-react";
import { type ConfidenceInput, getConfidenceLabel } from "@/lib/domain/confidence";
import { Badge } from "./Badge";

/** "Suspected · 78%" / "Estimate · 85%" (spec §6.7). Nulla se l'alert è confermato. */
export function ConfidenceBadge({ alert }: { alert: ConfidenceInput }) {
  const label = getConfidenceLabel(alert);
  if (!label) return null;
  return (
    <Badge
      className="border border-dashed border-muted/60 text-muted italic"
      title="Automatic detection from sensors, drone or weather. Felix confirms it in the field."
    >
      <ScanSearch size={12} aria-hidden />
      {label}
    </Badge>
  );
}
