import Image from "next/image";
import { Badge } from "@/components/ui/Badge";
import { Card, CardTitle } from "@/components/ui/Card";
import { getLatestSnapshot } from "@/lib/data/snapshot-store";
import { formatShortDate } from "@/lib/domain/format";
import { getPendingPhotos } from "@/lib/photos";
import { isStorageEnabled } from "@/lib/storage";
import { PlantPhotoUpload } from "./PlantPhotoUpload";

/** Foto delle piante del campo: quelle in attesa di Update e quelle già analizzate dalle API. */
export async function PlantPhotosPanel({ fieldId }: { fieldId: string }) {
  const [snapshot, pending] = await Promise.all([getLatestSnapshot(), getPendingPhotos()]);
  const waiting = pending.filter((p) => p.fieldId === fieldId);
  const analysed = [...(snapshot?.photos[fieldId] ?? [])].reverse();
  const storage = isStorageEnabled();

  return (
    <Card>
      <CardTitle aside={waiting.length ? `${waiting.length} waiting for update` : undefined}>Plant photos</CardTitle>
      <PlantPhotoUpload fieldId={fieldId} disabled={!storage} />
      {!storage && <p className="mt-2 text-xs text-muted">Photo upload needs a Vercel Blob store (BLOB_READ_WRITE_TOKEN).</p>}

      {(waiting.length > 0 || analysed.length > 0) && (
        <ul className="mt-3 grid grid-cols-2 gap-3">
          {waiting.map((p) => (
            <li key={p.url} className="space-y-1">
              <Image src={p.url} alt="Plant photo waiting for analysis" width={240} height={180} unoptimized className="h-28 w-full rounded-xl object-cover" />
              <Badge className="bg-maturity/15 text-ink">Waiting for update</Badge>
              <p className="text-xs text-muted">Uploaded {formatShortDate(p.uploadedAt)}</p>
            </li>
          ))}
          {analysed.map((p) => {
            const disease = p.cropHealth?.diseases[0];
            return (
              <li key={p.url} className="space-y-1">
                <Image src={p.url} alt="Analysed plant photo" width={240} height={180} unoptimized className="h-28 w-full rounded-xl object-cover" />
                {disease && (
                  <Badge
                    className={/^healthy$/i.test(disease.name) ? "bg-ok/10 text-ok" : "bg-disease/10 text-disease"}
                    title="crop.health identification"
                  >
                    {disease.name} · {Math.round(disease.probability * 100)}%
                  </Badge>
                )}
                {p.visualNotes && <p className="text-xs text-ink/80">{p.visualNotes}</p>}
                <p className="text-xs text-muted">Analysed {formatShortDate(p.analysedAt)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
