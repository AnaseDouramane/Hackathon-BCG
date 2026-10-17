"use client";
import { Camera, CircleCheck, Mail, TriangleAlert } from "lucide-react";
import { useActionState } from "react";
import { type UploadState, uploadFieldPhoto } from "@/app/(app)/fields/[id]/actions";
import { CategoryIcon } from "@/components/ui/CategoryIcon";
import { CATEGORY_LABEL } from "@/lib/domain/colors";
import { titleCase } from "@/lib/domain/format";
import type { EmailOutcome } from "@/lib/email/alerts";

const MAX_SIDE = 1600;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Riduce la foto nel browser (lato massimo 1600 px, JPEG): resta sotto i limiti di upload. */
async function toJpeg(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (blob) return blob;
  } catch {
    // formato che il browser non sa decodificare: sotto si accetta solo se è già JPEG
  }
  if (file.type === "image/jpeg") return file;
  throw new Error("This image format is not supported: use a JPEG or PNG photo.");
}

function EmailLine({ email }: { email: EmailOutcome }) {
  const text =
    email.status === "sent"
      ? `Email sent to ${email.recipients} recipient${email.recipients === 1 ? "" : "s"}${email.failed ? ` (${email.failed} failed)` : ""}.`
      : email.status === "not_configured"
        ? "Email not configured (SMTP / ALERT_EMAIL_TO)."
        : email.status === "failed"
          ? `Email not sent: ${email.error}`
          : null;
  if (!text) return null;
  return (
    <p className="mt-2 flex items-center gap-1 text-xs text-muted">
      <Mail size={14} aria-hidden /> {text}
    </p>
  );
}

/** Avviso dopo l'analisi della foto: problemi nuovi (con il rischio) oppure nessun problema. */
function Result({ state }: { state: NonNullable<UploadState> }) {
  if (!state.ok || !state.analysed) {
    return (
      <p className={`text-sm ${state.ok ? "text-ink" : "text-urgent"}`} aria-live="polite">
        {state.message}
      </p>
    );
  }
  if (state.issues.length === 0) {
    return (
      <div role="status" className="rounded-xl border border-ok bg-ok/10 p-3 text-sm text-ink">
        <p className="flex items-center gap-2 font-semibold">
          <CircleCheck size={18} className="text-ok" aria-hidden /> No new issue detected in this photo
        </p>
        {state.notes && <p className="mt-1 text-ink/80">{state.notes}</p>}
        {state.cropHealth && (
          <p className="mt-1 text-xs text-muted">
            crop.health: {state.cropHealth.name} ({Math.round(state.cropHealth.probability * 100)}%)
          </p>
        )}
      </div>
    );
  }
  return (
    <div role="alert" className="rounded-xl border-2 border-urgent bg-urgent/5 p-3 text-sm text-ink">
      <p className="flex items-center gap-2 font-bold text-urgent">
        <TriangleAlert size={18} aria-hidden /> New issue detected
      </p>
      <ul className="mt-2 space-y-2">
        {state.issues.map((issue) => (
          <li key={issue.category}>
            <p className="flex flex-wrap items-center gap-2 font-semibold">
              <CategoryIcon category={issue.category} size={16} />
              {issue.title}
            </p>
            <p className="text-xs font-semibold text-ink/80">
              {CATEGORY_LABEL[issue.category]} · {titleCase(issue.severity)} risk
              {issue.fromSeverity && ` (was ${titleCase(issue.fromSeverity)})`}
            </p>
            <p className="mt-1 text-ink/80">{issue.description}</p>
          </li>
        ))}
      </ul>
      {state.notes && <p className="mt-2 text-xs text-muted">Photo: {state.notes}</p>}
      <EmailLine email={state.email} />
    </div>
  );
}

export function PlantPhotoUpload({ fieldId, disabled }: { fieldId: string; disabled: boolean }) {
  const [state, upload, uploading] = useActionState<UploadState, FormData>(async (prev, formData) => {
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo first." };
    if (file.size > MAX_FILE_BYTES) return { ok: false, message: "The photo is too large (max 5 MB)." };
    try {
      const body = new FormData();
      body.set("photo", await toJpeg(file), "photo.jpg");
      return await uploadFieldPhoto(fieldId, prev, body);
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : "Upload failed." };
    }
  }, null);

  return (
    <div className="space-y-3">
      <form action={upload} className="space-y-2">
        <label className="block text-sm text-ink">
          Photo of a diseased plant, or of a plant to check for maturity (max 5 MB)
          <input
            type="file"
            name="photo"
            accept="image/*"
            required
            disabled={disabled || uploading}
            className="mt-1 block w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-surface file:px-4 file:font-semibold file:text-ink"
          />
        </label>
        <button
          type="submit"
          disabled={disabled || uploading}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Camera size={16} aria-hidden />
          {uploading ? "Analysing the photo…" : "Upload and analyse"}
        </button>
        {uploading && <p className="text-xs text-muted">crop.health and Claude are checking the plant — about 15 seconds.</p>}
      </form>
      {state && !uploading && <Result state={state} />}
    </div>
  );
}
