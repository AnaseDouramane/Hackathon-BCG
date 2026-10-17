"use client";
import { Mail, Plus, Trash2 } from "lucide-react";
import { useActionState, useTransition } from "react";
import { addRecipient, type RecipientsState, removeRecipient } from "@/app/(app)/settings/recipients/actions";

export function RecipientsForm({ recipients, disabled }: { recipients: string[]; disabled: boolean }) {
  const [added, add, adding] = useActionState<RecipientsState, FormData>(addRecipient, null);
  const [removing, startRemove] = useTransition();
  const busy = disabled || adding || removing;

  return (
    <div className="space-y-4">
      <form action={add} className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="recipient-email">
          Email address
        </label>
        <input
          id="recipient-email"
          name="email"
          type="email"
          required
          placeholder="name@example.com"
          disabled={busy}
          className="min-h-11 w-full max-w-sm rounded-lg border border-line px-3 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus size={16} aria-hidden /> {adding ? "Adding…" : "Add email"}
        </button>
      </form>
      {added && (
        <p className={`text-sm ${added.ok ? "text-ok" : "text-urgent"}`} aria-live="polite">
          {added.message}
        </p>
      )}

      {recipients.length === 0 ? (
        <p className="text-sm text-muted">No addresses added yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {recipients.map((email) => (
            <li key={email} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm text-ink">
                <Mail size={16} className="shrink-0 text-muted" aria-hidden />
                <span className="truncate">{email}</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => startRemove(async () => void (await removeRecipient(email)))}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-line/50 hover:text-urgent disabled:opacity-60"
                aria-label={`Remove ${email}`}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
