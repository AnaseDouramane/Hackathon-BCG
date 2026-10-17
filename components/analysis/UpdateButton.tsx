"use client";
import { RefreshCw } from "lucide-react";
import { startTransition, useActionState, useEffect } from "react";
import { runUpdate, type UpdateResult } from "@/app/actions";

const AUTO_RUN_KEY = "felix-analysis-autorun";

/**
 * "Update": rilancia le API. Con `autoRun` (nessuna analisi salvata) parte da solo all'apertura,
 * una volta per sessione del browser, così un errore non crea un ciclo.
 */
export function UpdateButton({ pendingPhotos, disabled, autoRun }: { pendingPhotos: number; disabled: boolean; autoRun: boolean }) {
  const [state, run, running] = useActionState<UpdateResult | null>(() => runUpdate(), null);

  useEffect(() => {
    if (!autoRun) return;
    try {
      if (sessionStorage.getItem(AUTO_RUN_KEY)) return;
      sessionStorage.setItem(AUTO_RUN_KEY, "1");
    } catch {
      // storage non disponibile: si parte comunque una volta
    }
    startTransition(run);
  }, [autoRun, run]);

  const label = running
    ? "Running analysis…"
    : `Update${pendingPhotos ? ` (${pendingPhotos} new photo${pendingPhotos === 1 ? "" : "s"})` : ""}`;

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        type="button"
        onClick={() => startTransition(run)}
        disabled={running || disabled}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw size={16} className={running ? "animate-spin" : ""} aria-hidden />
        {label}
      </button>
      <p className="text-xs text-muted" aria-live="polite">
        {running
          ? "Calling weather, soil, photo and risk APIs — this can take a minute."
          : state && !state.ok
            ? <span className="text-urgent">{state.error}</span>
            : state?.ok
              ? `Updated: ${state.issues ? `${state.issues} new issue${state.issues === 1 ? "" : "s"}` : "no new issues"}${state.photos ? `, ${state.photos} photo${state.photos === 1 ? "" : "s"} analysed` : ""}${state.email.status === "sent" ? ", email sent" : ""}.`
              : null}
      </p>
    </div>
  );
}
