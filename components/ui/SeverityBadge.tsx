import type { Severity } from "@/lib/contract/schemas";
import { titleCase } from "@/lib/domain/format";
import { Badge } from "./Badge";

// Toni neutri: il rosso è riservato alle urgenze (spec §6.1).
const STYLE: Record<Severity, string> = {
  CRITICAL: "bg-ink text-white",
  HIGH: "bg-ink/80 text-white",
  MEDIUM: "bg-ink/10 text-ink",
  LOW: "bg-transparent text-muted ring-1 ring-line",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge className={STYLE[severity]}>{titleCase(severity)}</Badge>;
}
