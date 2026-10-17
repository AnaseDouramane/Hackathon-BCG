"use client";

import { CloudRain, MapPin, Thermometer } from "lucide-react";
import { useEffect, useState } from "react";

// Lilongwe, capital of Malawi. Real conditions fetched once when the page loads (no live refresh).
const LAT = -13.9626;
const LNG = 33.7741;
const TZ = "Africa/Blantyre";
const URL_ =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}` +
  `&current=temperature_2m&daily=precipitation_sum&forecast_days=1&timezone=${encodeURIComponent(TZ)}`;

type Snapshot = { when: Date; tempC: number | null; rainMm: number | null };

export function LocalConditions() {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    const when = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- "now" only exists in the browser
    setSnap({ when, tempC: null, rainMm: null });
    const ctrl = new AbortController();
    fetch(URL_, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { current?: { temperature_2m?: number }; daily?: { precipitation_sum?: number[] } }) =>
        setSnap({
          when,
          tempC: d.current?.temperature_2m != null ? Math.round(d.current.temperature_2m) : null,
          rainMm: d.daily?.precipitation_sum?.[0] != null ? Math.round(d.daily.precipitation_sum[0] * 10) / 10 : null,
        }),
      )
      .catch(() => {});
    return () => ctrl.abort();
  }, []);

  if (!snap) return null;
  const date = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: TZ }).format(snap.when);
  const time = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TZ }).format(snap.when);

  return (
    <div className="hidden items-center gap-4 text-sm text-muted md:flex">
      <span className="flex items-center gap-1">
        <MapPin size={16} aria-hidden /> Lilongwe, Malawi
      </span>
      <span>
        {date} · {time}
      </span>
      {snap.tempC !== null && (
        <span className="flex items-center gap-1">
          <Thermometer size={16} aria-hidden /> {snap.tempC}°C
        </span>
      )}
      {snap.rainMm !== null && (
        <span className="flex items-center gap-1">
          <CloudRain size={16} aria-hidden /> {snap.rainMm} mm
        </span>
      )}
    </div>
  );
}
