import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import type { Field } from "@/data/types";
import { fieldStatus, formatDue, openAlerts, primaryAlert } from "@/data/fields";
import { STATUS, StatusBadge } from "./status";

export function FieldRow({ field, showAction = false }: { field: Field; showAction?: boolean }) {
  const st = fieldStatus(field);
  const a = primaryAlert(field);
  const extra = openAlerts(field).length - 1;
  return (
    <Link
      to="/fields/$id"
      params={{ id: field.id }}
      className={`flex min-h-16 items-center gap-3 rounded-xl border border-l-[6px] bg-card p-3 transition-colors hover:bg-accent ${STATUS[st].border}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">{field.id}</span>
          <span className="truncate font-semibold">{field.name}</span>
          <span className="text-sm capitalize text-muted-foreground">· {field.crop}</span>
        </div>
        <div className="mt-0.5 text-sm">{a?.title ?? "No active issues"}{extra > 0 && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold">+{extra} more issue{extra > 1 ? "s" : ""}</span>}</div>
        {showAction && a && (
          <div className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Next:</span> {a.recommendations[0].action} · {formatDue(a.dueInHours)}
          </div>
        )}
      </div>
      <StatusBadge category={st} className="shrink-0" />
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
