"use server";
// Aggiunta e rimozione degli indirizzi che ricevono le mail di avviso.
import { updateTag } from "next/cache";
import { isSignedIn } from "@/lib/auth/server";
import { EmailSchema, MAX_RECIPIENTS, RECIPIENTS_TAG, readRecipients, saveRecipients } from "@/lib/recipients";
import { isStorageEnabled } from "@/lib/storage";

export type RecipientsState = { ok: boolean; message: string } | null;

async function guard(): Promise<string | null> {
  if (!(await isSignedIn())) return "Your session has expired: sign in again.";
  if (!isStorageEnabled()) return "Saving recipients needs a Vercel Blob store (BLOB_READ_WRITE_TOKEN).";
  return null;
}

export async function addRecipient(_prev: RecipientsState, formData: FormData): Promise<RecipientsState> {
  const blocked = await guard();
  if (blocked) return { ok: false, message: blocked };
  const email = EmailSchema.safeParse(formData.get("email") ?? "");
  if (!email.success) return { ok: false, message: "Enter a valid email address." };

  const list = await readRecipients();
  if (list.includes(email.data)) return { ok: false, message: `${email.data} is already in the list.` };
  if (list.length >= MAX_RECIPIENTS) return { ok: false, message: `You can add up to ${MAX_RECIPIENTS} addresses.` };
  await saveRecipients([...list, email.data]);
  updateTag(RECIPIENTS_TAG);
  return { ok: true, message: `${email.data} will receive the alert emails.` };
}

export async function removeRecipient(email: string): Promise<RecipientsState> {
  const blocked = await guard();
  if (blocked) return { ok: false, message: blocked };
  const list = await readRecipients();
  await saveRecipients(list.filter((e) => e !== email));
  updateTag(RECIPIENTS_TAG);
  return { ok: true, message: `${email} removed.` };
}
