import "leaflet/dist/leaflet.css";
import { MapContainer, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import L from "leaflet";
import type { Field } from "@/data/types";
import { fieldStatus, openAlerts, primaryAlert } from "@/data/fields";
import { KASUNGU_CENTER } from "@/data/seed";
import { STATUS } from "./status";

function FitBounds({ fields }: { fields: Field[] }) {
  const map = useMap();
  useEffect(() => {
    if (!fields.length) return;
    map.fitBounds(L.latLngBounds(fields.flatMap((f) => f.polygon)), { padding: [30, 30], maxZoom: 15 });
  }, [fields, map]);
  return null;
}

export default function FieldMap({ fields, height = 520 }: { fields: Field[]; height?: number }) {
  return (
    <MapContainer center={KASUNGU_CENTER} zoom={12} style={{ height, width: "100%" }} scrollWheelZoom>
      <TileLayer
        attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
      />
      <FitBounds fields={fields} />
      {fields.map((f) => {
        const st = fieldStatus(f);
        const alert = primaryAlert(f);
        const multi = openAlerts(f).length > 1;
        return (
          <Polygon key={`${f.id}-${st}`} positions={f.polygon} pathOptions={{ className: `field-poly st-${st}${multi ? " multi" : ""}` }}>
            <Popup>
              <div className="min-w-56 space-y-1 text-sm">
                <div className="text-xs font-semibold text-muted-foreground">{f.id}</div>
                <div className="text-base font-bold text-foreground">{f.name}</div>
                <div className="capitalize">Crop: {f.crop}</div>
                <div>Issue: {alert?.title ?? "No active issues"}</div>
                <div className={`font-semibold ${STATUS[st].text}`}>
                  {STATUS[st].label}{alert ? ` · ${alert.severity}` : ""}{multi ? ` · ${openAlerts(f).length} issues` : ""}
                </div>
                <Link to="/fields/$id" params={{ id: f.id }} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 font-semibold !text-primary-foreground">
                  Open Field
                </Link>
              </div>
            </Popup>
          </Polygon>
        );
      })}
    </MapContainer>
  );
}
