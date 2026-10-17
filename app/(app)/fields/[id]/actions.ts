"use server";
// Upload della foto di una pianta e analisi immediata del campo (crop.health + Claude con l'immagine):
// restituisce i problemi nuovi da mostrare nell'avviso e manda la mail. Se l'analisi fallisce,
// la foto resta "in attesa" e la recupera il prossimo Update.
import { updateTag } from "next/cache";
import { isSignedIn } from "@/lib/auth/server";
import type { EmailOutcome, NewIssue } from "@/lib/email/alerts";
import { PHOTOS_TAG, savePendingPhoto } from "@/lib/photos";
import { analyseAndSave } from "@/lib/pipeline/update";
import { getFieldDetail } from "@/lib/services/fields";
import { isStorageEnabled } from "@/lib/storage";

const MAX_BYTES = 5 * 1024 * 1024;

export type UploadState =
  | { ok: false; message: string }
  | { ok: true; analysed: false; message: string }
  | {
      ok: true;
      analysed: true;
      issues: NewIssue[];
      notes: string;
      cropHealth: { name: string; probability: number } | null;
      email: EmailOutcome;
    }
  | null;

export async function uploadFieldPhoto(fieldId: string, _prev: UploadState, formData: FormData): Promise<UploadState> {
  if (!(await isSignedIn())) return { ok: false, message: "Your session has expired: sign in again." };
  if (!isStorageEnabled()) return { ok: false, message: "Photo upload is not configured (Vercel Blob)." };
  if (!(await getFieldDetail(fieldId))) return { ok: false, message: "Field not found." };

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo first." };
  if (!file.type.startsWith("image/")) return { ok: false, message: "The file must be an image." };
  if (file.size > MAX_BYTES) return { ok: false, message: "The photo is too large (max 5 MB)." };

  try {
    await savePendingPhoto(fieldId, Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    console.error("Photo upload failed", err);
    return { ok: false, message: "Upload failed, please try again." };
  }
  updateTag(PHOTOS_TAG);

  try {
    const result = await analyseAndSave([fieldId]);
    const photo = result.photos[fieldId]?.at(-1);
    return {
      ok: true,
      analysed: true,
      issues: result.issues.filter((i) => i.fieldId === fieldId),
      notes: photo?.visualNotes ?? "",
      cropHealth: photo?.cropHealth?.diseases[0] ?? null,
      email: result.email,
    };
  } catch (err) {
    console.error("Photo analysis failed", err);
    return { ok: true, analysed: false, message: "Photo uploaded, but the analysis failed: it will run on the next Update." };
  }
}
