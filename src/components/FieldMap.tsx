import { lazy, Suspense } from "react";
import { ClientOnly } from "@tanstack/react-router";
import type { Field } from "@/data/types";

const LazyMap = lazy(() => import("./FieldMap.client"));

export function FieldMap({ fields, height = 520 }: { fields: Field[]; height?: number }) {
  const fallback = (
    <div style={{ height }} className="flex w-full items-center justify-center bg-muted text-muted-foreground">
      Loading map…
    </div>
  );
  return (
    <div className="relative z-0 overflow-hidden rounded-xl border bg-card">
      <ClientOnly fallback={fallback}>
        <Suspense fallback={fallback}>
          <LazyMap fields={fields} height={height} />
        </Suspense>
      </ClientOnly>
      <div className="pointer-events-none absolute bottom-2 left-2 z-[500] rounded-md bg-card/90 px-2 py-1 text-xs font-medium text-muted-foreground">
        Illustrative field boundaries – not verified farm data
      </div>
    </div>
  );
}
