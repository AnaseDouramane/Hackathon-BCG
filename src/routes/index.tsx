import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CATEGORIES, countByCategory, fieldMatches, getFields, getPriorities } from "@/data/fields";
import type { Category } from "@/data/types";
import { FieldMap } from "@/components/FieldMap";
import { FieldRow } from "@/components/FieldRow";
import { STATUS, SimulatedTag } from "@/components/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard – Felix Field" },
      { name: "description", content: "Map of Kasungu fields with urgent issues, disease, fertilizer and harvest priorities." },
      { property: "og:title", content: "Felix Field Dashboard" },
      { property: "og:description", content: "See which Kasungu fields need attention today." },
    ],
  }),
  component: Dashboard,
});

const KPIS: { c: Category; label: string }[] = [
  { c: "urgent", label: "Urgent fields" },
  { c: "disease", label: "Disease / pest" },
  { c: "fertilizer", label: "Need fertilizer / soil" },
  { c: "maturity", label: "Approaching harvest" },
];

function Dashboard() {
  const [active, setActive] = useState<Set<Category>>(new Set());
  const all = getFields();
  const shown = useMemo(() => (active.size ? all.filter((f) => [...active].some((c) => fieldMatches(f, c))) : all), [active, all]);
  const toggle = (c: Category) => setActive((s) => { const n = new Set(s); n.has(c) ? n.delete(c) : n.add(c); return n; });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-extrabold">Kasungu District</h1>
          <p className="text-muted-foreground">{all.length} monitored fields · status as of Fri 16 Oct 2026</p>
        </div>
        <SimulatedTag>Illustrative demo data</SimulatedTag>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPIS.map(({ c, label }) => {
          const S = STATUS[c];
          return (
            <Link key={c} to="/issues/$category" params={{ category: c }} className={cn("flex items-center gap-3 rounded-xl border border-t-[6px] bg-card p-4 hover:bg-accent", S.border)}>
              <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-lg", S.soft, S.text)}><S.icon className="h-6 w-6" /></span>
              <div className="min-w-0">
                <div className="font-display text-3xl font-extrabold">{countByCategory(c)}</div>
                <div className="text-sm font-semibold text-muted-foreground">{label}</div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Map filters">
            <button onClick={() => setActive(new Set())} aria-pressed={!active.size} className={cn("min-h-11 rounded-full border px-4 font-semibold", !active.size ? "bg-foreground text-background" : "bg-card")}>All</button>
            {CATEGORIES.map((c) => {
              const S = STATUS[c]; const on = active.has(c);
              return (
                <button key={c} onClick={() => toggle(c)} aria-pressed={on} className={cn("flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-semibold", S.border, on ? cn(S.bg, "text-primary-foreground") : cn("bg-card", S.text))}>
                  <S.icon className="h-4 w-4" />{S.short}
                </button>
              );
            })}
          </div>
          <FieldMap fields={shown} height={540} />
          {!shown.length && <p className="text-muted-foreground">No fields match these filters.</p>}
          <Legend />
        </section>

        <aside className="space-y-3">
          <h2 className="text-xl font-bold">Today's Priorities</h2>
          <ol className="space-y-2">
            {getPriorities(5).map((f, i) => (
              <li key={f.id} className="flex gap-2">
                <span className="mt-4 w-5 shrink-0 text-center font-display font-bold text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1"><FieldRow field={f} showAction /></div>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="rounded-xl border bg-card p-3">
      <div className="mb-2 text-sm font-bold">Legend</div>
      <ul className="grid gap-2 text-sm sm:grid-cols-3">
        {CATEGORIES.map((c) => {
          const S = STATUS[c];
          return (
            <li key={c} className="flex items-center gap-2">
              <span className={cn("grid h-6 w-6 shrink-0 place-items-center rounded", S.bg)}><S.icon className="h-4 w-4 text-primary-foreground" /></span>
              <span><b>{S.label}</b> – {S.desc}</span>
            </li>
          );
        })}
        <li className="flex items-center gap-2"><span className="h-6 w-6 shrink-0 rounded border-2 border-dashed border-foreground" /><span><b>Dashed outline</b> – multiple issues</span></li>
      </ul>
    </div>
  );
}
