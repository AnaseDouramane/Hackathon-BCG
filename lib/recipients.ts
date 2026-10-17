// Indirizzi aggiunti dalla pagina Settings → Alert recipients. Ricevono le stesse mail di ALERT_EMAIL_TO.
// Salvati come le analisi (Vercel Blob o .data/): ogni modifica scrive un file nuovo, si legge il più recente.
import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";
import { deleteFiles, isStorageEnabled, listFiles, putFile, readFileText } from "@/lib/storage";

export const RECIPIENTS_TAG = "recipients";
export const MAX_RECIPIENTS = 20;
const PREFIX = "settings/recipients/";
const KEEP = 5;

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email());

/** Lettura diretta, senza cache (per l'invio delle mail e le Server Action). */
export async function readRecipients(): Promise<string[]> {
  if (!isStorageEnabled()) return [];
  try {
    const latest = (await listFiles(PREFIX)).at(-1);
    const text = latest ? await readFileText(latest.pathname) : null;
    const parsed = z.array(z.string()).safeParse(text ? JSON.parse(text) : []);
    return parsed.success ? parsed.data : [];
  } catch (err) {
    console.error("Could not read alert recipients", err);
    return [];
  }
}

/** Per la pagina (in cache, tag "recipients"). */
export async function getRecipients(): Promise<string[]> {
  "use cache";
  cacheTag(RECIPIENTS_TAG);
  cacheLife("minutes");
  return readRecipients();
}

export async function saveRecipients(list: string[]): Promise<void> {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "");
  await putFile(`${PREFIX}${stamp}.json`, JSON.stringify(list), "application/json");
  const all = await listFiles(PREFIX);
  await deleteFiles(all.slice(0, Math.max(0, all.length - KEEP)));
}

/** ALERT_EMAIL_TO + indirizzi aggiunti, senza doppioni. */
export function mergeRecipients(fromEnv: string[], added: string[]): string[] {
  return [...new Set([...fromEnv, ...added].map((e) => e.trim().toLowerCase()).filter(Boolean))];
}
