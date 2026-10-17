"use server";
// "Update": rilancia la pipeline delle API sui primi 50 campi (Claude rivaluta solo quelli con evidenze
// cambiate), salva lo snapshot, aggiorna le pagine e manda le mail per i problemi nuovi.
// Gira anche da sola alla prima apertura, quando non c'è ancora nessuna analisi.
import { isSignedIn } from "@/lib/auth/server";
import type { EmailOutcome } from "@/lib/email/alerts";
import { loadKasunguDb } from "@/lib/kasungu/db";
import { listPendingPhotos } from "@/lib/photos";
import { analyseAndSave } from "@/lib/pipeline/update";
import type { FieldChange, SourceStatus } from "@/lib/pipeline/types";
import { isStorageEnabled } from "@/lib/storage";

const UPDATE_FIELD_LIMIT = 50;

export type UpdateResult =
  | { ok: true; createdAt: string; changes: FieldChange[]; sources: SourceStatus[]; photos: number; issues: number; email: EmailOutcome }
  | { ok: false; error: string };

export async function runUpdate(): Promise<UpdateResult> {
  if (!(await isSignedIn())) return { ok: false, error: "Your session has expired: sign in again." };
  if (!isStorageEnabled()) {
    return { ok: false, error: "Storage is not configured: connect a Vercel Blob store (BLOB_READ_WRITE_TOKEN)." };
  }
  try {
    // per velocità solo i primi campi del db (più quelli con una foto ancora da analizzare);
    // gli altri tengono il risultato precedente
    const pending = await listPendingPhotos();
    const scope = [...new Set([...loadKasunguDb().fields.slice(0, UPDATE_FIELD_LIMIT).map((f) => f.field_id), ...pending.map((p) => p.fieldId)])];
    const result = await analyseAndSave(scope);
    return {
      ok: true,
      createdAt: result.createdAt,
      changes: result.changes,
      sources: result.sources,
      photos: result.analysedPhotos,
      issues: result.issues.length,
      email: result.email,
    };
  } catch (err) {
    console.error("Analysis update failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Analysis failed" };
  }
}
