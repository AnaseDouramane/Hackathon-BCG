import { TriangleAlert } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import type { AlertDto } from "@/lib/contract/schemas";
import { CATEGORY_LABEL } from "@/lib/domain/colors";
import { formatShortDate, titleCase } from "@/lib/domain/format";

export function AlertList({ alerts }: { alerts: AlertDto[] }) {
  return (
    <Card>
      <CardTitle aside={`${alerts.length} open`}>Issues detected</CardTitle>
      {alerts.length === 0 ? (
        <p className="text-sm text-ok">No open issues. The lamp is green.</p>
      ) : (
        <ul className="space-y-3">
          {alerts.map((alert) => (
            <li key={alert.id} className={`rounded-xl border p-3 ${alert.isUrgent ? "border-urgent bg-urgent/5" : "border-line"}`}>
              <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                {alert.isUrgent && <TriangleAlert size={16} className="text-urgent" aria-label="Urgent" />}
                <CategoryIcon category={alert.category} size={16} />
                <span className="sr-only">{CATEGORY_LABEL[alert.category]}:</span>
                {alert.title}
                <SeverityBadge severity={alert.severity} />
                <ConfidenceBadge alert={alert} />
              </p>
              <p className="mt-1 text-sm text-ink/80">{alert.description}</p>
              <p className="mt-1 text-xs text-muted">
                {titleCase(alert.source)} · detected {formatShortDate(alert.detectedAt)}
                {alert.dueAt && <> · act by {formatShortDate(alert.dueAt)}</>}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
