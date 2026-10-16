import { Info } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import type { ActionDto } from "@/lib/contract/schemas";
import { ADVICE_DISCLAIMER } from "@/lib/domain/confidence";
import { formatDue, formatShortDate, titleCase } from "@/lib/domain/format";

/** "What to do", in ordine di priorità (spec §6.4, §8.3). */
export function ActionList({ actions, now }: { actions: ActionDto[]; now: Date }) {
  return (
    <Card>
      <CardTitle aside="by priority">What to do</CardTitle>
      {actions.length === 0 ? (
        <p className="text-sm text-muted">Nothing to do on this field right now.</p>
      ) : (
        <ol className="space-y-3">
          {actions.map((action, i) => (
            <li
              key={action.id}
              className={`flex gap-3 rounded-xl border p-3 ${action.isUrgent ? "border-urgent" : "border-line"} ${
                action.done ? "opacity-60" : ""
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${
                  action.isUrgent ? "bg-urgent" : "bg-ink/70"
                }`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold text-ink">
                    <CategoryIcon category={action.category} size={16} />
                    {action.title}
                  </p>
                  {action.dueAt && (
                    <p className={`text-sm font-medium ${action.isUrgent ? "text-urgent" : "text-muted"}`}>
                      due {formatShortDate(action.dueAt)} · {formatDue(action.dueAt, now)}
                    </p>
                  )}
                </div>
                <p className="mt-1 text-sm text-ink/80">
                  <span className="font-medium text-ink">Why: </span>
                  {action.why}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                  Source: {titleCase(action.source)}
                  <ConfidenceBadge alert={action} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
        <Info size={14} aria-hidden /> {ADVICE_DISCLAIMER}
      </p>
    </Card>
  );
}
