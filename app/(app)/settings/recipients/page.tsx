import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RecipientsForm } from "@/components/settings/RecipientsForm";
import { Card } from "@/components/ui/Card";
import { getRecipients } from "@/lib/recipients";
import { isStorageEnabled } from "@/lib/storage";

export const metadata: Metadata = { title: "Alert recipients" };

export default async function RecipientsPage() {
  const recipients = await getRecipients();
  const storage = isStorageEnabled();

  return (
    <main className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-line text-muted hover:text-ink"
          aria-label="Back to dashboard"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-ink">Alert recipients</h1>
      </div>
      <Card>
        <p className="mb-4 text-sm text-ink/80">
          These addresses receive an email for every new issue found on a field (&ldquo;Dear farmer, your field has an issue&rdquo;),
          from photo uploads and from Update.
        </p>
        <RecipientsForm recipients={recipients} disabled={!storage} />
        {!storage && <p className="mt-3 text-xs text-muted">Saving recipients needs a Vercel Blob store (BLOB_READ_WRITE_TOKEN).</p>}
      </Card>
    </main>
  );
}
