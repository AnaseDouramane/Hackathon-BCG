// Foto delle piante caricate dalla pagina del campo.
// photos/pending/<campo>/… finché non vengono analizzate con "Update", poi photos/done/<campo>/….
import { cacheLife, cacheTag } from "next/cache";
import { isStorageEnabled, listFiles, moveFile, putFile, type StoredFile } from "@/lib/storage";

export const PHOTOS_TAG = "photos";
const PENDING = "photos/pending/";
const DONE = "photos/done/";

export type PendingPhoto = StoredFile & { fieldId: string };
export type PendingPhotoDto = { fieldId: string; url: string; uploadedAt: string };

const stamp = () => new Date().toISOString().replace(/[^0-9]/g, "");

export async function savePendingPhoto(fieldId: string, bytes: Buffer): Promise<StoredFile> {
  return putFile(`${PENDING}${fieldId}/${stamp()}.jpg`, bytes, "image/jpeg");
}

export async function listPendingPhotos(): Promise<PendingPhoto[]> {
  if (!isStorageEnabled()) return [];
  const files = await listFiles(PENDING);
  return files.map((f) => ({ ...f, fieldId: f.pathname.slice(PENDING.length).split("/")[0] }));
}

/** Foto in attesa di Update (in cache, tag "photos"). */
export async function getPendingPhotos(): Promise<PendingPhotoDto[]> {
  "use cache";
  cacheTag(PHOTOS_TAG);
  cacheLife("minutes");
  try {
    return (await listPendingPhotos()).map((p) => ({ fieldId: p.fieldId, url: p.url, uploadedAt: p.uploadedAt.toISOString() }));
  } catch (err) {
    console.error("Could not list pending photos", err);
    return [];
  }
}

/** Sposta le foto analizzate in photos/done; restituisce il nuovo URL di ognuna. */
export async function markPhotosDone(photos: PendingPhoto[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  for (const p of photos) {
    const moved = await moveFile(p, DONE + p.pathname.slice(PENDING.length));
    urls.set(p.url, moved.url);
  }
  return urls;
}
