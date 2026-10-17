import Image from "next/image";
import { Card, CardTitle } from "@/components/ui/Card";
import { ConfidenceBadge } from "@/components/ui/ConfidenceBadge";
import type { AlertDto, DroneCaptureDto } from "@/lib/contract/schemas";
import { formatShortDate } from "@/lib/domain/format";

/** Ultima cattura del drone; se ha generato un sospetto, mostra la sua confidenza (spec §8.3). */
export function DronePanel({ capture, droneAlert }: { capture: DroneCaptureDto | null; droneAlert: AlertDto | null }) {
  return (
    <Card>
      <CardTitle aside={capture ? formatShortDate(capture.capturedAt) : undefined}>Drone</CardTitle>
      {!capture ? (
        <p className="text-sm text-muted">No data</p>
      ) : (
        <>
          <Image
            src={capture.imageUrl}
            alt="Sample NDVI drone imagery of the field"
            width={480}
            height={300}
            unoptimized
            className="h-auto w-full rounded-xl"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            {capture.ndviMean !== null && (
              <span className="font-semibold text-ink tabular-nums">NDVI {capture.ndviMean.toFixed(2)}</span>
            )}
            {droneAlert && <ConfidenceBadge alert={droneAlert} />}
          </div>
          {capture.findings && <p className="mt-1 text-sm text-ink/80">{capture.findings}</p>}
          <p className="mt-2 text-xs text-muted">Sample imagery for the demo. NDVI: low = stressed or dry canopy.</p>
        </>
      )}
    </Card>
  );
}
