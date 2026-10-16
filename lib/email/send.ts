// Invio email indipendente dal resto dell'app: sendEmail(...) si può chiamare da qualunque punto
// (route, script, job). Trasporto SMTP configurato solo da variabili d'ambiente (.env.local / Vercel).
import nodemailer, { type Transporter } from "nodemailer";
import { type EmailParams, type EmailTemplate, renderEmail } from "@/lib/email/template";

export type SendEmailInput = {
  /** Lista dei destinatari: ognuno riceve la sua mail, senza vedere gli altri. */
  recipients: string[];
  template: EmailTemplate;
  params?: EmailParams;
};

export type SendEmailResult = { sent: string[]; failed: { to: string; error: string }[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const isEmailEnabled = () => Boolean(process.env.SMTP_HOST && process.env.EMAIL_FROM);

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transporter;
}

/** Sostituisce il trasporto (usato nei test). */
export function setTransporter(t: Transporter | null) {
  transporter = t;
}

export async function sendEmail({ recipients, template, params = {} }: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailEnabled()) throw new Error("Email not configured: set SMTP_HOST and EMAIL_FROM");
  const unique = [...new Set(recipients.map((r) => r.trim()).filter(Boolean))];
  const invalid = unique.filter((r) => !EMAIL_RE.test(r));
  if (invalid.length) throw new Error(`Invalid email address: ${invalid.join(", ")}`);
  if (!unique.length) throw new Error("No recipients");

  const { subject, text, html } = renderEmail(template, params);
  const result: SendEmailResult = { sent: [], failed: [] };
  for (const to of unique) {
    try {
      await getTransporter().sendMail({ from: process.env.EMAIL_FROM, to, subject, text, html });
      result.sent.push(to);
    } catch (err) {
      result.failed.push({ to, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
