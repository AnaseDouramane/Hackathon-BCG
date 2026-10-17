// Mail di avviso per i problemi nuovi o aggravati trovati dall'analisi (foto caricata o Update).
// Destinatari: ALERT_EMAIL_TO (indirizzi separati da virgola) più quelli aggiunti da Settings → Alert recipients. Una mail per problema, con lo stesso
// titolo e la stessa descrizione dell'alert mostrato nell'app.
import type { Category, Severity } from "@/lib/contract/schemas";
import type { Seed } from "@/lib/contract/seed-schema";
import type { FieldChange } from "@/lib/pipeline/types";
import { mergeRecipients, readRecipients } from "@/lib/recipients";
import { isEmailEnabled, sendEmail } from "./send";
import type { EmailTemplate } from "./template";

export const ISSUE_EMAIL: EmailTemplate = {
  subject: "Felix Field — issue on field {{code}}",
  body: "Dear farmer, your field has an issue:\n\n{{title}}\n\n{{description}}",
};

export type NewIssue = {
  fieldId: string;
  code: string;
  name: string;
  category: Category;
  severity: Severity;
  fromSeverity?: Severity;
  title: string;
  description: string;
};

export type EmailOutcome =
  | { status: "sent"; recipients: number; failed: number }
  | { status: "none" | "not_configured" }
  | { status: "failed"; error: string };

export const alertRecipients = () =>
  (process.env.ALERT_EMAIL_TO ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Problemi nuovi o aggravati, con la descrizione completa dell'alert. */
export function newIssues(changes: FieldChange[], seed: Seed): NewIssue[] {
  return changes.flatMap((c) =>
    [...c.added, ...c.escalated].map((a) => {
      const alert = seed.alerts.find((x) => x.fieldId === c.fieldId && x.category === a.category && x.status === "OPEN");
      return {
        fieldId: c.fieldId,
        code: c.code,
        name: c.name,
        category: a.category,
        severity: a.severity,
        ...(a.fromSeverity ? { fromSeverity: a.fromSeverity } : {}),
        title: a.title,
        description: alert?.description ?? "",
      };
    }),
  );
}

export async function emailIssues(issues: NewIssue[]): Promise<EmailOutcome> {
  if (!issues.length) return { status: "none" };
  const recipients = mergeRecipients(alertRecipients(), await readRecipients());
  if (!isEmailEnabled() || !recipients.length) return { status: "not_configured" };
  try {
    let failed = 0;
    for (const issue of issues) {
      const result = await sendEmail({
        recipients,
        template: ISSUE_EMAIL,
        params: { code: issue.code, title: issue.title, description: issue.description },
      });
      failed += result.failed.length;
    }
    return { status: "sent", recipients: recipients.length, failed };
  } catch (err) {
    console.error("Issue email failed", err);
    return { status: "failed", error: err instanceof Error ? err.message : "Email failed" };
  }
}
