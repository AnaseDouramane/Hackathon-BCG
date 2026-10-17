"use client";

// Mappa satellitare con i campi colorati (spec §6.3, §8.1). Gira solo nel browser:
// importarla tramite FieldMapLazy.
import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { FieldSummary, LampColor } from "@/lib/contract/schemas";
import { LAMP_HEX } from "@/lib/domain/colors";
import { formatDue } from "@/lib/domain/format";

export type FieldMapProps = {
  fields: FieldSummary[];
  /** Campi su cui centrare la mappa all'apertura (default: `fields`). */
  boundsFields?: FieldSummary[];
  highlightId?: string | null;
  onHover?: (id: string | null) => void;
  nowIso: string;
  className?: string;
};

const ESRI_URL = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const ESRI_ATTRIBUTION = "Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community";

/** Sotto questo zoom i poligoni sarebbero troppo piccoli: ogni campo diventa un pallino colorato. */
const POLYGON_MIN_ZOOM = 14;

/** Raggio del pallino: più piccolo da lontano, così i campi di un villaggio non si coprono a vicenda. */
function dotRadius(rank: number, zoom: number, highlighted: boolean): number {
  const scale = zoom <= 11 ? 0.55 : zoom === 12 ? 0.75 : 1;
  const base = highlighted ? 10 : rank === 2 ? 8 : rank === 1 ? 6.5 : 4;
  return Math.max(2.5, base * scale);
}

const toLatLngs = (f: FieldSummary): LatLngTuple[] => f.boundary.coordinates[0].map(([lng, lat]) => [lat, lng]);

const patternId = (colors: LampColor[]) => `stripe-${colors.join("-").toLowerCase()}`;

function fillFor(field: FieldSummary): string {
  if (field.lampColors.length > 1) return `url(#${patternId(field.lampColors)})`;
  return LAMP_HEX[field.lampColors[0]];
}

/** I campi con problemi vanno disegnati sopra quelli verdi, gli urgenti sopra tutti. */
const drawRank = (f: FieldSummary) => (f.isUrgent ? 2 : f.categories.length > 0 ? 1 : 0);

function boundsOf(fields: FieldSummary[]): LatLngBoundsExpression | undefined {
  const points = fields.flatMap(toLatLngs);
  if (points.length === 0) return undefined;
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  return [
    [Math.min(...lats), Math.min(...lngs)],
    [Math.max(...lats), Math.max(...lngs)],
  ];
}

/** Pattern SVG a strisce per i campi con più problemi. Leaflet li usa via fill="url(#…)". */
function StripePatterns({ fields }: { fields: FieldSummary[] }) {
  const combos = new Map<string, LampColor[]>();
  for (const f of fields) if (f.lampColors.length > 1) combos.set(patternId(f.lampColors), f.lampColors);
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <defs>
        {[...combos].map(([id, colors]) => {
          const stripe = 5;
          return (
            <pattern
              key={id}
              id={id}
              patternUnits="userSpaceOnUse"
              width={stripe * colors.length}
              height={stripe * colors.length}
              patternTransform="rotate(45)"
            >
              {colors.map((c, i) => (
                <rect key={c} x={i * stripe} y="0" width={stripe} height={stripe * colors.length} fill={LAMP_HEX[c]} />
              ))}
            </pattern>
          );
        })}
      </defs>
    </svg>
  );
}

function FieldPopup({ field, now, onClose }: { field: FieldSummary; now: Date; onClose: () => void }) {
  return (
    <Popup position={[field.centroid.lat, field.centroid.lng]} eventHandlers={{ remove: onClose }}>
      <div className="min-w-48 space-y-1 text-sm">
        <p className="font-semibold text-ink">
          {field.code} · {field.name}
        </p>
        <p className="text-muted">
          {field.crop?.name ?? "No crop"} · {field.areaHa} ha · {field.farmerName}
        </p>
        {field.topAlert ? (
          <p className="text-ink">
            {field.topAlert.title}
            {field.topAlert.dueAt && <span className="text-muted"> · due {formatDue(field.topAlert.dueAt, now)}</span>}
          </p>
        ) : (
          <p className="text-ok">No issues detected</p>
        )}
        <Link href={`/fields/${field.id}`} className="mt-1 inline-flex min-h-11 items-center font-semibold text-fertilizer!">
          Open field →
        </Link>
      </div>
    </Popup>
  );
}

/** Leaflet only listens to window resizes: redraw when the container changes (e.g. sidebar toggle). */
function ResizeSync() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

function FieldLayers({ fields, highlightId, onHover, nowIso }: Omit<FieldMapProps, "boundsFields" | "className">) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const map = useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  const currentZoom = zoom ?? map.getZoom();
  const showPolygons = currentZoom >= POLYGON_MIN_ZOOM;
  const now = new Date(nowIso);

  const ordered = [...fields].sort(
    (a, b) => drawRank(a) - drawRank(b) || Number(a.id === highlightId) - Number(b.id === highlightId),
  );
  const selected = fields.find((f) => f.id === selectedId) ?? null;

  return (
    <>
      {ordered.map((field) => {
        const highlighted = field.id === highlightId;
        const handlers = {
          click: () => setSelectedId(field.id),
          mouseover: () => onHover?.(field.id),
          mouseout: () => onHover?.(null),
        };
        if (showPolygons) {
          return (
            <Polygon
              key={field.id}
              positions={toLatLngs(field)}
              pathOptions={{
                color: highlighted ? "#ffffff" : "#1d2721",
                weight: highlighted ? 4 : 1.5,
                fillColor: fillFor(field),
                fillOpacity: highlighted ? 0.85 : 0.6,
              }}
              eventHandlers={handlers}
            />
          );
        }
        return (
          <CircleMarker
            key={field.id}
            center={[field.centroid.lat, field.centroid.lng]}
            radius={dotRadius(drawRank(field), currentZoom, highlighted)}
            pathOptions={{
              color: highlighted ? "#1d2721" : "#ffffff",
              weight: highlighted ? 3 : 1.2,
              fillColor: fillFor(field),
              fillOpacity: 0.95,
            }}
            eventHandlers={handlers}
          />
        );
      })}
      {selected && <FieldPopup field={selected} now={now} onClose={() => setSelectedId(null)} />}
      {!showPolygons && (
        <div className="pointer-events-none absolute top-3 right-3 z-[1000] rounded-full bg-white/90 px-3 py-1 text-xs text-muted shadow">
          Zoom in to see field boundaries
        </div>
      )}
    </>
  );
}

export default function FieldMap({ fields, boundsFields, highlightId, onHover, nowIso, className = "" }: FieldMapProps) {
  // Next 16 non smonta le pagine quando si naviga: le nasconde con <Activity> ed esegue i cleanup
  // degli effetti. react-leaflet distrugge la mappa nel cleanup e non la ricrea quando la pagina
  // torna visibile ("Cannot read properties of null (reading '_targets')").
  // Montiamo quindi la mappa solo mentre il componente è visibile: torna sempre nuova.
  const [visible, setVisible] = useState(false);
  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- segue la visibilità data da <Activity>
    setVisible(true);
    return () => setVisible(false);
  }, []);

  const bounds = boundsOf(boundsFields ?? fields);

  return (
    <div className={`relative isolate overflow-hidden rounded-2xl bg-line ${className}`}>
      <StripePatterns fields={fields} />
      {visible && (
        <MapContainer
          bounds={bounds}
          boundsOptions={{ padding: [24, 24] }}
          center={bounds ? undefined : [-13.03, 33.48]}
          zoom={bounds ? undefined : 13}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer url={ESRI_URL} attribution={ESRI_ATTRIBUTION} maxNativeZoom={17} maxZoom={19} />
          <ResizeSync />
          <FieldLayers fields={fields} highlightId={highlightId} onHover={onHover} nowIso={nowIso} />
        </MapContainer>
      )}
    </div>
  );
}
