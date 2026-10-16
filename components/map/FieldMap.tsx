"use client";

// Mappa satellitare con i campi colorati (spec §6.3, §8.1). Gira solo nel browser:
// importarla tramite FieldMapLazy.
import "leaflet/dist/leaflet.css";
import type { LatLngBoundsExpression, LatLngTuple } from "leaflet";
import Link from "next/link";
import { MapContainer, Polygon, Popup, TileLayer, Tooltip } from "react-leaflet";
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

const toLatLngs = (f: FieldSummary): LatLngTuple[] => f.boundary.coordinates[0].map(([lng, lat]) => [lat, lng]);

const patternId = (colors: LampColor[]) => `stripe-${colors.join("-").toLowerCase()}`;

function fillFor(field: FieldSummary): string {
  if (field.lampColors.length > 1) return `url(#${patternId(field.lampColors)})`;
  return LAMP_HEX[field.lampColors[0]];
}

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
          const stripe = 7;
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

export default function FieldMap({ fields, boundsFields, highlightId, onHover, nowIso, className = "" }: FieldMapProps) {
  const now = new Date(nowIso);
  const bounds = boundsOf(boundsFields ?? fields);

  return (
    <div className={`relative isolate overflow-hidden rounded-2xl ${className}`}>
      <StripePatterns fields={fields} />
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [24, 24] }}
        center={bounds ? undefined : [-13.03, 33.48]}
        zoom={bounds ? undefined : 14}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer url={ESRI_URL} attribution={ESRI_ATTRIBUTION} maxNativeZoom={17} maxZoom={19} />
        {fields.map((field) => {
          const highlighted = field.id === highlightId;
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
              eventHandlers={{
                mouseover: () => onHover?.(field.id),
                mouseout: () => onHover?.(null),
              }}
            >
              <Tooltip direction="top" sticky>
                <strong>{field.code}</strong> · {field.crop?.name ?? "No crop"}
              </Tooltip>
              <Popup>
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
                      {field.topAlert.dueAt && (
                        <span className="text-muted"> · due {formatDue(field.topAlert.dueAt, now)}</span>
                      )}
                    </p>
                  ) : (
                    <p className="text-ok">No issues detected</p>
                  )}
                  <Link
                    href={`/fields/${field.id}`}
                    className="mt-1 inline-flex min-h-11 items-center font-semibold text-fertilizer!"
                  >
                    Open field →
                  </Link>
                </div>
              </Popup>
            </Polygon>
          );
        })}
      </MapContainer>
    </div>
  );
}
