import { Card, CardTitle } from "@/components/ui/Card";
import type { FieldDetail } from "@/lib/contract/schemas";
import { formatShortDate, titleCase } from "@/lib/domain/format";

const DAY = 86_400_000;

export function CropTimeline({ planting, now }: { planting: FieldDetail["planting"]; now: Date }) {
  if (!planting) {
    return (
      <Card>
        <CardTitle>Crop timeline</CardTitle>
        <p className="text-sm text-muted">No active planting.</p>
      </Card>
    );
  }

  const start = Date.parse(planting.plantedAt);
  const hStart = Date.parse(planting.expectedHarvestStart);
  const hEnd = Date.parse(planting.expectedHarvestEnd);
  const end = hEnd + 7 * DAY;
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - start) / (end - start)) * 100))}%`;
  const today = now.getTime();
  const daysToHarvest = Math.ceil((hStart - today) / DAY);
  const status =
    today > hEnd
      ? "Harvest window has passed"
      : today >= hStart
        ? "Harvest window is open now"
        : `Harvest window opens in ${daysToHarvest} days`;

  return (
    <Card>
      <CardTitle aside={`Stage: ${titleCase(planting.growthStage)}`}>Crop timeline · {planting.crop.name}</CardTitle>
      <div className="relative mx-2 mt-6 mb-8 h-3 rounded-full bg-ok/25">
        <div className="absolute inset-y-0 left-0 rounded-full bg-ok/60" style={{ width: pct(today) }} />
        <div
          className="absolute inset-y-[-4px] rounded-md border-2 border-maturity bg-maturity/40"
          style={{ left: pct(hStart), width: `calc(${pct(hEnd)} - ${pct(hStart)})` }}
          title="Expected harvest window"
        />
        <div className="absolute -top-6 -translate-x-1/2 text-xs font-semibold text-ink" style={{ left: pct(today) }}>
          today
        </div>
        <div className="absolute top-[-6px] h-6 w-1 -translate-x-1/2 rounded bg-ink" style={{ left: pct(today) }} />
        <div className="absolute top-5 left-0 text-xs text-muted">planted {formatShortDate(planting.plantedAt)}</div>
        <div className="absolute top-5 text-xs whitespace-nowrap text-maturity" style={{ left: pct(hStart) }}>
          harvest {formatShortDate(planting.expectedHarvestStart)}–{formatShortDate(planting.expectedHarvestEnd)}
        </div>
      </div>
      <p className="text-sm font-medium text-ink">{status}</p>
    </Card>
  );
}
