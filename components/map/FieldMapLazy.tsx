"use client";

import dynamic from "next/dynamic";

/** Leaflet usa `window`: la mappa si carica solo nel browser. */
export const FieldMapLazy = dynamic(() => import("./FieldMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-2xl bg-line" aria-label="Loading map" />,
});
