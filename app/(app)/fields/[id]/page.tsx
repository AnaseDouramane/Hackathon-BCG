import { ArrowLeft, MapPin, Phone } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionList } from "@/components/field/ActionList";
import { AlertList } from "@/components/field/AlertList";
import { CropTimeline } from "@/components/field/CropTimeline";
import { DronePanel } from "@/components/field/DronePanel";
import { Lamp } from "@/components/field/Lamp";
import { PlantPhotosPanel } from "@/components/field/PlantPhotosPanel";
import { SensorPanel } from "@/components/field/SensorPanel";
import { WeatherStrip } from "@/components/field/WeatherStrip";
import { CROP_PHOTO } from "@/components/ui/crop";
import type { CropCode } from "@/lib/contract/schemas";
import { getNow } from "@/lib/now";
import { getFieldDetail, listFieldIds } from "@/lib/services/fields";

const FALLBACK_GRADIENT = "linear-gradient(135deg, #2f6b3a, #7bb661)";

function bannerImage(cropCode: CropCode | undefined): string {
  if (!cropCode) return FALLBACK_GRADIENT;
  return `url(${CROP_PHOTO[cropCode].src}), ${FALLBACK_GRADIENT}`;
}

// L'upload di una foto (Server Action di questa pagina) analizza subito il campo con crop.health e Claude
export const maxDuration = 120;

export async function generateStaticParams() {
  return (await listFieldIds()).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/fields/[id]">): Promise<Metadata> {
  const field = await getFieldDetail((await params).id);
  return { title: field ? `${field.code} · ${field.name}` : "Field not found" };
}

// params is read inside a Suspense boundary so the shell can render instantly.
export default function FieldPage({ params }: PageProps<"/fields/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-line" aria-busy="true" aria-label="Loading field" />}>
      <FieldContent params={params} />
    </Suspense>
  );
}

async function FieldContent({ params }: { params: PageProps<"/fields/[id]">["params"] }) {
  const field = await getFieldDetail((await params).id);
  if (!field) notFound();

  const now = getNow();
  const droneAlert = field.alerts.find((a) => a.source === "DRONE") ?? null;

  return (
    <main className="space-y-4">
      {/* Banner: one photo per crop type from fields_photos/ (see CROP_PHOTO); gradient for fields without crop. */}
      <header
        className="relative overflow-hidden rounded-2xl border border-line bg-cover bg-center shadow-sm"
        style={{ backgroundImage: bannerImage(field.crop?.code) }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-black/10" aria-hidden />
        <div className="relative flex min-h-36 flex-wrap items-center justify-between gap-4 p-4 text-white">
          <div className="flex items-start gap-4">
            <Link
              href="/"
              className="mt-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/20 backdrop-blur hover:bg-white/30"
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold drop-shadow">
                {field.code} · {field.name}
              </h1>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-white/90">
                <span>
                  {field.crop?.name ?? "No crop"} · {field.areaHa} ha
                </span>
                <span className="flex items-center gap-1">
                  <MapPin size={14} aria-hidden /> {field.farmer.village}
                </span>
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                <span>
                  Farmer: <span className="font-semibold">{field.farmer.name}</span>
                </span>
                <span className="flex items-center gap-1 text-white/90">
                  <Phone size={14} aria-hidden /> {field.farmer.phone}
                </span>
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-white/90 px-4 py-2 shadow backdrop-blur">
            <Lamp colors={field.lampColors} />
          </div>
        </div>
      </header>

      <CropTimeline planting={field.planting} now={now} />

      <WeatherStrip days={field.weather} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_400px]">
        <div className="space-y-4">
          <ActionList actions={field.actions} now={now} />
          <AlertList alerts={field.alerts} />
        </div>
        <div className="space-y-4">
          <SensorPanel reading={field.latestSensorReading} />
          <DronePanel capture={field.latestDroneCapture} droneAlert={droneAlert} />
          <PlantPhotosPanel fieldId={field.id} />
        </div>
      </div>
    </main>
  );
}
