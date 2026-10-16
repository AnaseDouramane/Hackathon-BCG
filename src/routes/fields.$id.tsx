import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Camera, Cloud, CloudLightning, CloudRain, Phone, Plane, Sun, User } from "lucide-react";
import { fieldStatus, formatDue, getField, isAlertUrgent, openAlerts, SEVERITY_RANK } from "@/data/fields";
import type { Field, WeatherDay } from "@/data/types";
import { FieldMap } from "@/components/FieldMap";
import { STATUS, SimulatedTag, StatusBadge } from "@/components/status";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/fields/$id")({
  loader: ({ params }) => {
    const field = getField(params.id);
    if (!field) throw notFound();
    return { field };
  },
  head: ({ loaderData }) => {
    const t = loaderData ? `${loaderData.field.name} (${loaderData.field.id})` : "Field unavailable";
    return {
      meta: [
        { title: `${t} – Felix Field` },
        { name: "description", content: loaderData ? `Issues, soil, weather and actions for ${loaderData.field.name}, ${loaderData.field.village}.` : "Field details" },
        { property: "og:title", content: `${t} – Felix Field` },
        { property: "og:description", content: "Field details with recommended actions." },
        ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
      ],
    };
  },
  component: FieldPage,
});

function Card({ title, children, tag }: { title: string; children: React.ReactNode; tag?: boolean }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-lg font-bold">{title}</h2>{tag && <SimulatedTag />}</div>
      {children}
    </section>
  );
}

function FieldPage() {
  const { field: f } = Route.useLoaderData();
  const st = fieldStatus(f);
  const alerts = [...openAlerts(f)].sort((a, b) => Number(isAlertUrgent(b)) - Number(isAlertUrgent(a)) || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  return (
    <div className="space-y-4">
      <button onClick={() => history.back()} className="inline-flex min-h-11 items-center gap-2 font-semibold text-primary"><ArrowLeft className="h-5 w-5" />Back</button>

      <div className={cn("flex flex-wrap items-center gap-4 rounded-xl border border-l-[8px] bg-card p-4", STATUS[st].border)}>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-muted-foreground">{f.id} · {f.village} village</div>
          <h1 className="text-3xl font-extrabold">{f.name}</h1>
          <div className="mt-1 capitalize text-muted-foreground">{f.crop} · {f.areaHa} ha · {f.stage}</div>
        </div>
        <StatusBadge category={st} className="text-base" />
        {alerts.length > 1 && <span className="rounded-full bg-foreground px-3 py-1 text-sm font-bold text-background">{alerts.length} active issues</span>}
        <Link to="/diagnose" search={{ field: f.id }} className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground"><Camera className="h-5 w-5" />Diagnose Crop</Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {alerts.length === 0 && <Card title="Recommended actions"><p className="text-muted-foreground">No active issues. Continue routine monitoring.</p></Card>}
          {alerts.map((a) => {
            const S = STATUS[isAlertUrgent(a) ? "urgent" : a.category];
            return (
              <section key={a.id} className={cn("rounded-xl border-2 bg-card p-4", S.border)}>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge category={a.category} />
                  {isAlertUrgent(a) && <StatusBadge category="urgent" />}
                  <span className="text-sm font-semibold uppercase text-muted-foreground">Severity: {a.severity}</span>
                  <span className={cn("ml-auto text-sm font-bold", S.text)}>{formatDue(a.dueInHours)}</span>
                </div>
                <h2 className="mt-2 text-xl font-bold">{a.title}</h2>
                <ol className="mt-3 space-y-3">
                  {a.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-3">
                      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full font-bold text-primary-foreground", S.bg)}>{i + 1}</span>
                      <div>
                        <div className="font-semibold">{r.action}</div>
                        <div className="text-sm text-muted-foreground"><b>Why:</b> {r.why}</div>
                        <div className="text-sm"><b>When:</b> {r.window}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <p className="mt-3 text-xs text-muted-foreground">Preliminary guidance – confirm in the field before treatment.</p>
              </section>
            );
          })}

          <Card title="Soil sensor readings" tag><Soil f={f} /></Card>
          <Card title="5-day weather forecast" tag><Weather days={f.weather} /></Card>
        </div>

        <div className="space-y-4">
          <Card title="Farmer contact">
            <div className="space-y-2">
              <div className="flex items-center gap-2"><User className="h-5 w-5 text-muted-foreground" />{f.farmer.name}</div>
              <div className="flex items-center gap-2"><Phone className="h-5 w-5 text-muted-foreground" />{f.farmer.phone}</div>
            </div>
          </Card>
          <Card title="Smart field lamp" tag>
            <div className="flex items-center gap-4">
              <span className={cn("lamp-glow h-14 w-14 shrink-0 rounded-full", STATUS[st].bg, STATUS[st].text)} aria-hidden />
              <div><div className={cn("font-bold", STATUS[st].text)}>{STATUS[st].label}</div><div className="text-sm text-muted-foreground">Simulated – no physical lamp connected.</div></div>
            </div>
          </Card>
          <Card title="Crop timeline">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted-foreground">Growth stage</dt><dd className="font-semibold">{f.stage}</dd></div>
              <div><dt className="text-muted-foreground">Planting date</dt><dd className="font-semibold">{new Date(f.plantingDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</dd></div>
              <div><dt className="text-muted-foreground">Estimated harvest window</dt><dd className="font-semibold">{f.harvestWindow}</dd></div>
            </dl>
          </Card>
          <Card title="Aerial imagery" tag={!!f.drone}>
            {f.drone ? (
              <div className="flex gap-3"><Plane className="h-5 w-5 shrink-0 text-muted-foreground" /><div><div className="text-sm font-semibold">Drone flight {f.drone.date}</div><p className="text-sm">{f.drone.note}</p></div></div>
            ) : <p className="text-sm text-muted-foreground">No recent drone imagery for this field.</p>}
          </Card>
          <FieldMap fields={[f]} height={260} />
        </div>
      </div>
    </div>
  );
}

function Soil({ f }: { f: Field }) {
  const s = f.soil;
  const items = [
    { label: "Moisture", v: `${s.moisture}%`, low: s.moisture < 28 },
    { label: "Temperature", v: `${s.temperature} °C`, low: false },
    { label: "pH", v: s.ph.toFixed(1), low: s.ph < 5.5 },
    { label: "Nitrogen (N)", v: `${s.nitrogen} mg/kg`, low: s.nitrogen < 20 },
    { label: "Phosphorus (P)", v: `${s.phosphorus} mg/kg`, low: s.phosphorus < 12 },
    { label: "Potassium (K)", v: `${s.potassium} mg/kg`, low: s.potassium < 100 },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((i) => (
        <div key={i.label} className={cn("rounded-lg border p-3", i.low && "border-fertilizer bg-fertilizer-soft")}>
          <div className="text-sm text-muted-foreground">{i.label}</div>
          <div className="font-display text-2xl font-bold">{i.v}</div>
          {i.low && <div className="text-xs font-bold text-fertilizer">Below target</div>}
        </div>
      ))}
    </div>
  );
}

const W = { sunny: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning };
function Weather({ days }: { days: WeatherDay[] }) {
  const heavy = days.some((d) => d.rainMm >= 20);
  return (
    <>
      {heavy && <p className="mb-3 rounded-lg bg-urgent-soft p-2 text-sm font-semibold text-urgent">Heavy rain expected – plan field work before it arrives.</p>}
      <div className="grid grid-cols-5 gap-2">
        {days.map((d) => {
          const I = W[d.condition];
          return (
            <div key={d.day} className={cn("rounded-lg border p-2 text-center", d.rainMm >= 20 && "border-urgent")}>
              <div className="font-semibold">{d.day}</div>
              <I className="mx-auto my-1 h-7 w-7" aria-label={d.condition} />
              <div className="text-sm">{d.high}° / {d.low}°</div>
              <div className="text-xs text-muted-foreground">{d.rainMm} mm</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
