import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import { LampDot } from "@/components/ui/LampDot";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import type { FieldSummary } from "@/lib/contract/schemas";
import { formatDue, titleCase } from "@/lib/domain/format";

export function IssueRow({
  field,
  now,
  highlighted,
  onHover,
}: {
  field: FieldSummary;
  now: Date;
  highlighted: boolean;
  onHover: (id: string | null) => void;
}) {
  const alert = field.topAlert;
  const others = field.openAlertsCount - 1;
  const due = alert ? formatDue(alert.dueAt, now) : null;

  return (
    <li>
      <Link
        href={`/fields/${field.id}`}
        onMouseEnter={() => onHover(field.id)}
        onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(field.id)}
        onBlur={() => onHover(null)}
        className={`flex min-h-20 items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
          highlighted ? "border-ink" : "border-line"
        } ${alert?.isUrgent ? "border-l-4 border-l-urgent" : ""}`}
      >
        <LampDot colors={field.lampColors} size={20} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-base font-semibold text-ink">
            {field.code} · {field.name}
            <span className="text-sm font-normal text-muted">
              {field.crop?.name} · {field.areaHa} ha · {field.farmerName}
            </span>
            {others > 0 && (
              <span className="rounded-full bg-ink/10 px-2 py-0.5 text-xs font-medium text-ink">
                +{others} {others === 1 ? "issue" : "issues"}
              </span>
            )}
          </p>
          {alert && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              {alert.isUrgent ? (
                <TriangleAlert size={16} className="text-urgent" aria-label="Urgent" />
              ) : (
                <CategoryIcon category={alert.category} size={16} />
              )}
              <span className="text-ink">{alert.title}</span>
              <SeverityBadge severity={alert.severity} />
              <span className="text-muted">source: {titleCase(alert.source)}</span>
              <ConfidenceBadge alert={alert} />
            </div>
          )}
        </div>
        {due && (
          <div className="text-right">
            <p className="text-xs text-muted uppercase">Due</p>
            <p className={`text-sm font-semibold ${alert?.isUrgent ? "text-urgent" : "text-ink"}`}>{due}</p>
          </div>
        )}
        <ChevronRight className="text-muted" size={20} aria-hidden />
      </Link>
    </li>
  );
}
