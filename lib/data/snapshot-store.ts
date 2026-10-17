// Snapshot dell'analisi: ogni giro della pipeline salva un file nuovo in snapshots/, si legge il più recente.
// La lettura è in cache (tag "analysis") e viene invalidata con updateTag dopo ogni Update.
import { cacheLife, cacheTag } from "next/cache";
import type { AnalysisSnapshot } from "@/lib/pipeline/types";
import { deleteFiles, isStorageEnabled, listFiles, putFile, readFileText } from "@/lib/storage";

export const ANALYSIS_TAG = "analysis";
const PREFIX = "snapshots/";
const KEEP = 20;

/** Lettura diretta, senza cache (per la Server Action di Update). */
export async function readLatestSnapshot(): Promise<AnalysisSnapshot | null> {
  if (!isStorageEnabled()) return null;
  try {
    const latest = (await listFiles(PREFIX)).at(-1);
    const text = latest ? await readFileText(latest.pathname) : null;
    return text ? (JSON.parse(text) as AnalysisSnapshot) : null;
  } catch (err) {
    console.error("Could not read the latest analysis snapshot", err);
    return null;
  }
}

export async function getLatestSnapshot(): Promise<AnalysisSnapshot | null> {
  "use cache";
  cacheTag(ANALYSIS_TAG);
  cacheLife("minutes");
  return readLatestSnapshot();
}

export async function saveSnapshot(snapshot: AnalysisSnapshot): Promise<void> {
  const stamp = snapshot.createdAt.replace(/[^0-9]/g, "");
  await putFile(`${PREFIX}${stamp}.json`, JSON.stringify(snapshot), "application/json");
  const all = await listFiles(PREFIX);
  await deleteFiles(all.slice(0, Math.max(0, all.length - KEEP)));
}
