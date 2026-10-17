// Un giro di analisi "completo": legge l'ultima analisi e le foto in attesa, lancia la pipeline,
// salva lo snapshot, sposta le foto analizzate e manda le mail per i problemi nuovi.
// Lo usano sia "Update" (tutti i campi) sia l'upload di una foto (solo quel campo).
import { updateTag } from "next/cache";
import { SeedSchema } from "@/lib/contract/seed-schema";
import { seed as baseSeed } from "@/lib/data/memory-repository";
import { ANALYSIS_TAG, readLatestSnapshot, saveSnapshot } from "@/lib/data/snapshot-store";
import { type EmailOutcome, emailIssues, type NewIssue, newIssues } from "@/lib/email/alerts";
import { getNow } from "@/lib/now";
import { listPendingPhotos, markPhotosDone, PHOTOS_TAG } from "@/lib/photos";
import { readFileBytes } from "@/lib/storage";
import { runAnalysis } from "./run";
import type { AnalysisSnapshot, FieldChange, PhotoFinding, SourceStatus } from "./types";

export type AnalysisResult = {
  createdAt: string;
  changes: FieldChange[];
  sources: SourceStatus[];
  issues: NewIssue[];
  email: EmailOutcome;
  photos: Record<string, PhotoFinding[]>;
  analysedPhotos: number;
};

// un giro alla volta per istanza: due snapshot scritti in parallelo si perderebbero a vicenda
let queue: Promise<unknown> = Promise.resolve();

export function analyseAndSave(onlyFieldIds?: string[]): Promise<AnalysisResult> {
  const run = queue.then(() => analyse(onlyFieldIds));
  queue = run.catch(() => undefined);
  return run;
}

async function analyse(onlyFieldIds?: string[]): Promise<AnalysisResult> {
  const previousSnapshot = await readLatestSnapshot();
  const previous = previousSnapshot ? SeedSchema.parse(previousSnapshot.seed) : baseSeed;
  const pending = (await listPendingPhotos()).filter((p) => !onlyFieldIds || onlyFieldIds.includes(p.fieldId));
  const newPhotos = await Promise.all(
    pending.map(async (p) => ({ fieldId: p.fieldId, url: p.url, uploadedAt: p.uploadedAt, bytes: await readFileBytes(p) })),
  );

  const out = await runAnalysis({
    base: baseSeed,
    previous,
    previousPhotos: previousSnapshot?.photos ?? {},
    previousFingerprints: previousSnapshot?.fingerprints ?? {},
    newPhotos,
    onlyFieldIds,
    now: getNow(),
  });

  const moved = await markPhotosDone(pending);
  for (const list of Object.values(out.photos)) for (const p of list) p.url = moved.get(p.url) ?? p.url;

  const snapshot: AnalysisSnapshot = {
    version: 1,
    createdAt: new Date().toISOString(),
    sources: out.sources,
    changes: out.changes,
    photos: out.photos,
    fingerprints: out.fingerprints,
    seed: out.seed,
  };
  await saveSnapshot(snapshot);
  updateTag(ANALYSIS_TAG);
  updateTag(PHOTOS_TAG);

  const issues = newIssues(out.changes, out.seed);
  const email = await emailIssues(issues);
  return {
    createdAt: snapshot.createdAt,
    changes: out.changes,
    sources: out.sources,
    issues,
    email,
    photos: out.photos,
    analysedPhotos: pending.length,
  };
}
