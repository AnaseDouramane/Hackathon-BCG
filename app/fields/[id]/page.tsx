import { ArrowLeft, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionList } from "@/components/field/ActionList";
import { AlertList } from "@/components/field/AlertList";
import { CropTimeline } from "@/components/field/CropTimeline";
import { DronePanel } from "@/components/field/DronePanel";
import { Lamp } from "@/components/field/Lamp";
import { SensorPanel } from "@/components/field/SensorPanel";
import { WeatherStrip } from "@/components/field/WeatherStrip";
import { getNow } from "@/lib/now";
import { getFieldDetail, listFieldIds } from "@/lib/services/fields";

export async function generateStaticParams() {
  return (await listFieldIds()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/fields/[id]">): Promise<Metadata> {
  const field = await getFieldDetail((await params).id);
  return { title: field ? `${field.code} · ${field.name}` : "Field not found" };
}

export default async function FieldPage({ params }: PageProps<"/fields/[id]">) {
  const field = await getFieldDetail((await params).id);
  if (!field) notFound();

  const now = getNow();
  const droneAlert = field.alerts.find((a) => a.source === "DRONE") ?? null;

  return (
    <main className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-4 shadow-sm">
        <div className="flex items-start gap-4">
          <Link
            href="/"
            className="mt-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-muted hover:text-ink"
            aria-label="Back to dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-ink">
              {field.code} · {field.name}
            </h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted">
              <span>
                {field.crop?.name ?? "No crop"} · {field.areaHa} ha
              </span>
              <span className="flex items-center gap-1">
                <MapPin size={14} aria-hidden /> {field.farmer.village}
              </span>
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-ink">
              <span>
                Farmer: <span className="font-semibold">{field.farmer.name}</span>
              </span>
              <span className="flex items-center gap-1 text-muted">
                <Phone size={14} aria-hidden /> {field.farmer.phone}
              </span>
            </p>
          </div>
        </div>
        <Lamp colors={field.lampColors} />
      </header>

      <CropTimeline planting={field.planting} now={now} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <ActionList actions={field.actions} now={now} />
          <AlertList alerts={field.alerts} />
        </div>
        <div className="space-y-4">
          <SensorPanel reading={field.latestSensorReading} />
          <WeatherStrip days={field.weather} />
          <DronePanel capture={field.latestDroneCapture} droneAlert={droneAlert} />
        </div>
      </div>
    </main>
  );
}
