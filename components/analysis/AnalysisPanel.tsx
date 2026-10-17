import { ArrowRight, Check, CircleMinus, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { LampDot } from "@/components/ui/LampDot";
import { getLatestSnapshot } from "@/lib/data/snapshot-store";
import { formatTime, titleCase } from "@/lib/domain/format";
import { getPendingPhotos } from "@/lib/photos";
import type { FieldChange, SourceStatus } from "@/lib/pipeline/types";
import { isStorageEnabled } from "@/lib/storage";
import { UpdateButton } from "./UpdateButton";

const SOURCE_LABEL: Record<SourceStatus["name"], string> = {
  weather: "Weather",
  isda: "iSDA soil",
  cropHealth: "crop.health",
  claude: "Claude risk",
};

const MAX_CHANGES = 8;

function SourceChip({ source }: { source: SourceStatus }) {
  const ok = source.status === "ok";
  const failed = source.status === "error" || source.status === "partial";
  return (
    <span
      title={source.detail ?? titleCase(source.status)}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? "bg-ok/10 text-ok" : failed ? "bg-urgent/10 text-urgent" : "bg-line text-muted"
      }`}
    >
      {ok ? <Check size={12} aria-hidden /> : failed ? <TriangleAlert size={12} aria-hidden /> : <CircleMinus size={12} aria-hidden />}
      {SOURCE_LABEL[source.name]}
      <span className="sr-only">: {source.status}</span>
    </span>
  );
}

function ChangeRow({ change }: { change: FieldChange }) {
  return (
    <li>
      <Link href={`/fields/${change.fieldId}`} className="flex min-h-11 items-start gap-3 rounded-xl px-2 py-2 hover:bg-surface">
        <span className="mt-0.5 flex shrink-0 items-center gap-1">
          <LampDot colors={change.before} size={12} />
          <ArrowRight size={12} className="text-muted" aria-label="becomes" />
          <LampDot colors={change.after} size={12} />
        </span>
        <span className="min-w-0 text-sm">
          <span className="font-semibold text-ink">
            {change.code} · {change.name}
          </span>
          {change.added.map((a) => (
            <span key={`a${a.category}`} className="flex items-center gap-1 text-ink">
              <CategoryIcon category={a.category} size={14} /> New: {a.title}
            </span>
          ))}
          {change.escalated.map((a) => (
            <span key={`e${a.category}`} className="flex items-center gap-1 text-ink">
              <CategoryIcon category={a.category} size={14} /> Worse ({titleCase(a.fromSeverity ?? "")} → {titleCase(a.severity)}): {a.title}
            </span>
          ))}
          {change.resolved.map((a) => (
            <span key={`r${a.category}`} className="flex items-center gap-1 text-muted">
              <CategoryIcon category={a.category} size={14} /> Resolved: {a.title}
            </span>
          ))}
        </span>
      </Link>
    </li>
  );
}

/** Stato dell'analisi delle API, bottone Update e cosa è cambiato rispetto all'analisi precedente. */
export async function AnalysisPanel() {
  const [snapshot, pending] = await Promise.all([getLatestSnapshot(), getPendingPhotos()]);
  const storage = isStorageEnabled();
  const changes = snapshot?.changes ?? [];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xs font-semibold tracking-wider text-muted uppercase">Field analysis</h2>
          <p className="text-sm text-ink">
            {snapshot
              ? `Last update at ${formatTime(snapshot.createdAt)}`
              : storage
                ? "No analysis yet: showing the monitoring data until the first run completes."
                : "Analysis storage is not configured: showing the monitoring data."}
          </p>
          {snapshot && (
            <div className="flex flex-wrap gap-1.5">
              {snapshot.sources.map((s) => (
                <SourceChip key={s.name} source={s} />
              ))}
            </div>
          )}
        </div>
        <UpdateButton pendingPhotos={pending.length} disabled={!storage} autoRun={storage && !snapshot} />
      </div>

      {snapshot && (
        <details className="mt-3 border-t border-line pt-2" open={changes.length > 0}>
          <summary className="cursor-pointer py-1 text-sm font-semibold text-ink">
            What changed since the previous update ({changes.length} field{changes.length === 1 ? "" : "s"})
          </summary>
          {changes.length === 0 ? (
            <p className="py-1 text-sm text-muted">No new issues detected.</p>
          ) : (
            <ul className="mt-1 grid gap-x-4 md:grid-cols-2">
              {changes.slice(0, MAX_CHANGES).map((c) => (
                <ChangeRow key={c.fieldId} change={c} />
              ))}
            </ul>
          )}
          {changes.length > MAX_CHANGES && <p className="px-2 text-xs text-muted">+ {changes.length - MAX_CHANGES} more fields</p>}
        </details>
      )}
    </Card>
  );
}
