import { ChevronRight, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LampDot } from "@/components/ui/LampDot";
import type { FieldSummary } from "@/lib/contract/schemas";
import { formatDue } from "@/lib/domain/format";

/** I primi 5 campi della lista ordinata per priorità (spec §8.1). */
export function TodayPriorities({ fields, now }: { fields: FieldSummary[]; now: Date }) {
  const top = fields.filter((f) => f.topAlert).slice(0, 5);
  return (
    <aside className="flex h-full min-h-0 flex-col rounded-2xl border border-line bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Today&apos;s priorities</h2>
        <Link href="/issues/urgent" className="inline-flex min-h-11 items-center gap-0.5 text-sm font-semibold text-urgent">
          All urgent <ChevronRight size={16} aria-hidden />
        </Link>
      </div>
      <ol className="flex-1 space-y-1 overflow-y-auto">
        {top.map((field, i) => {
          const alert = field.topAlert!;
          return (
            <li key={field.id}>
              <Link
                href={`/fields/${field.id}`}
                className="flex min-h-14 items-start gap-3 rounded-xl px-2 py-2 transition hover:bg-surface"
              >
                <span
                  className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${
                    alert.isUrgent ? "bg-urgent" : "bg-ink/70"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <LampDot colors={field.lampColors} size={12} />
                    {field.code} · {field.crop?.name}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-ink">
                    {alert.isUrgent ? (
                      <TriangleAlert size={14} className="text-urgent" aria-label="Urgent" />
                    ) : (
                      <CategoryIcon category={alert.category} size={14} />
                    )}
                    <span className="truncate">{alert.title}</span>
                  </p>
                  {alert.dueAt && <p className="text-xs text-muted">Due {formatDue(alert.dueAt, now)}</p>}
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
