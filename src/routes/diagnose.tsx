import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RotateCcw, Upload } from "lucide-react";
import { classifier, type Classification } from "@/lib/classifier";
import { getFields } from "@/data/fields";
import type { Crop } from "@/data/types";
import { SimulatedTag } from "@/components/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/diagnose")({
  validateSearch: (s: Record<string, unknown>): { field?: string } => (typeof s.field === "string" ? { field: s.field } : {}),
  head: () => ({
    meta: [
      { title: "Diagnose Crop – Felix Field" },
      { name: "description", content: "Take or upload a crop photo for a preliminary disease, pest or nutrient assessment." },
      { property: "og:title", content: "Diagnose Crop – Felix Field" },
      { property: "og:description", content: "Photo-based preliminary crop assessment." },
    ],
  }),
  component: Diagnose,
});

const CROPS: Crop[] = ["maize", "soybean", "beans", "tobacco", "groundnut"];

function Diagnose() {
  const { field: initialField } = Route.useSearch();
  const fields = getFields();
  const [fieldId, setFieldId] = useState(initialField ?? "");
  const [crop, setCrop] = useState<Crop>(fields.find((f) => f.id === initialField)?.crop ?? "maize");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [result, setResult] = useState<Classification | null>(null);
  const [saved, setSaved] = useState(false);
  const cam = useRef<HTMLInputElement>(null);
  const up = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f?: File) => {
    if (!f) return;
    setFile(f); setPreview(URL.createObjectURL(f)); setResult(null); setState("idle"); setSaved(false);
  };
  const run = async () => {
    if (!file) return;
    setState("loading"); setSaved(false);
    try { setResult(await classifier.classify(file, crop)); setState("done"); } catch { setState("error"); }
  };
  const uncertain = result && result.confidence < 0.7;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-3xl font-extrabold">Diagnose Crop</h1>
        <SimulatedTag>Simulated classifier – no ML model connected</SimulatedTag>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="space-y-4 rounded-xl border bg-card p-4">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => cam.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground"><Camera className="h-5 w-5" />Take photo</button>
            <button onClick={() => up.current?.click()} className="flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 border-primary font-semibold text-primary"><Upload className="h-5 w-5" />Upload image</button>
            <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
            <input ref={up} type="file" accept="image/*" className="hidden" aria-label="Upload crop image" onChange={(e) => pick(e.target.files?.[0])} />
          </div>
          <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-lg border-2 border-dashed bg-muted">
            {preview ? <img src={preview} alt="Selected crop" className="h-full w-full object-cover" /> : <span className="text-muted-foreground">No photo selected</span>}
          </div>
          <div>
            <div className="mb-2 font-semibold">Crop type</div>
            <div className="flex flex-wrap gap-2">
              {CROPS.map((c) => (
                <button key={c} onClick={() => setCrop(c)} aria-pressed={crop === c} className={cn("min-h-11 rounded-full border-2 px-4 font-semibold capitalize", crop === c ? "border-primary bg-primary text-primary-foreground" : "bg-card")}>{c}</button>
              ))}
            </div>
          </div>
          <button disabled={!file || state === "loading"} onClick={run} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-lg bg-foreground font-bold text-background disabled:opacity-40">
            {state === "loading" ? <><Loader2 className="h-5 w-5 animate-spin" />Assessing…</> : "Run crop assessment"}
          </button>
        </section>

        <section className="rounded-xl border bg-card p-4">
          {state === "idle" && <p className="text-muted-foreground">Take or upload a photo, choose the crop, then run the assessment.</p>}
          {state === "loading" && <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Analysing photo…</div>}
          {state === "error" && <div className="space-y-2"><p className="font-semibold text-destructive">Assessment failed.</p><button onClick={run} className="min-h-11 rounded-lg border px-4 font-semibold">Try again</button></div>}
          {state === "done" && result && (
            <div className="space-y-3">
              <SimulatedTag>Simulated result</SimulatedTag>
              <div className="text-sm font-semibold uppercase text-muted-foreground">{result.category}</div>
              <h2 className="text-2xl font-extrabold">{result.label}</h2>
              <div className="flex flex-wrap gap-4 text-sm">
                <div><span className="text-muted-foreground">Confidence</span><div className="font-display text-2xl font-bold">{Math.round(result.confidence * 100)}%</div></div>
                <div><span className="text-muted-foreground">Severity</span><div className="font-display text-2xl font-bold capitalize">{result.severity}</div></div>
              </div>
              {uncertain && <p className="rounded-lg bg-maturity-soft p-2 text-sm font-semibold">Uncertain prediction – retake a closer photo in daylight or confirm by inspecting the plant.</p>}
              <p>{result.explanation}</p>
              <ul className="list-disc space-y-1 pl-5">{result.nextSteps.map((s) => <li key={s}>{s}</li>)}</ul>
              <p className="text-xs text-muted-foreground">Preliminary guidance – confirm before treatment.</p>
              <button onClick={run} className="inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 font-semibold"><RotateCcw className="h-4 w-4" />Retry</button>

              <div className="border-t pt-3">
                <label className="mb-1 block font-semibold" htmlFor="fieldsel">Associate with field</label>
                <div className="flex gap-2">
                  <select id="fieldsel" value={fieldId} onChange={(e) => { setFieldId(e.target.value); setSaved(false); }} className="min-h-12 min-w-0 flex-1 rounded-lg border bg-card px-3">
                    <option value="">No field</option>
                    {fields.filter((f) => f.crop === crop).map((f) => <option key={f.id} value={f.id}>{f.id} – {f.name}</option>)}
                  </select>
                  <button disabled={!fieldId} onClick={() => setSaved(true)} className="min-h-12 rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">Save</button>
                </div>
                {saved && <p className="mt-2 text-sm text-healthy">Result linked to <Link to="/fields/$id" params={{ id: fieldId }} className="font-semibold underline">{fieldId}</Link> for this session (demo only).</p>}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
