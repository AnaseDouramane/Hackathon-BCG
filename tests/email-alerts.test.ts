import type { Transporter } from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import rawSeed from "@/data/seed.json";
import { SeedSchema } from "@/lib/contract/seed-schema";
import { emailIssues, newIssues } from "@/lib/email/alerts";
import { setTransporter } from "@/lib/email/send";
import type { FieldChange } from "@/lib/pipeline/types";

const seed = SeedSchema.parse(rawSeed);
const alert = seed.alerts.find((a) => a.status === "OPEN")!;
const field = seed.fields.find((f) => f.id === alert.fieldId)!;
const change: FieldChange = {
  fieldId: field.id,
  code: field.code,
  name: field.name,
  before: ["GREEN"],
  after: ["PURPLE"],
  added: [{ category: alert.category, severity: alert.severity, title: alert.title }],
  resolved: [],
  escalated: [],
};

const sendMail = vi.fn(async () => ({}));

beforeEach(() => {
  vi.stubEnv("SMTP_HOST", "smtp.test");
  vi.stubEnv("EMAIL_FROM", "felix@test.org");
  vi.stubEnv("ALERT_EMAIL_TO", "judge1@test.org, judge2@test.org");
  sendMail.mockClear();
  setTransporter({ sendMail } as unknown as Transporter);
});

afterEach(() => setTransporter(null));

describe("issue emails", () => {
  it("takes the alert's own title and description", () => {
    const [issue] = newIssues([change], seed);
    expect(issue).toMatchObject({ code: field.code, title: alert.title, description: alert.description });
  });

  it('sends "Dear farmer, your field has an issue" to every ALERT_EMAIL_TO address', async () => {
    const outcome = await emailIssues(newIssues([change], seed));
    expect(outcome).toEqual({ status: "sent", recipients: 2, failed: 0 });
    expect(sendMail).toHaveBeenCalledTimes(2);
    const mail = (sendMail.mock.calls[0] as unknown as [{ to: string; subject: string; text: string }])[0];
    expect(mail.to).toBe("judge1@test.org");
    expect(mail.subject).toBe(`Felix Field — issue on field ${field.code}`);
    expect(mail.text).toBe(`Dear farmer, your field has an issue:\n\n${alert.title}\n\n${alert.description}`);
  });

  it("sends nothing without new issues or without recipients", async () => {
    expect(await emailIssues([])).toEqual({ status: "none" });
    vi.stubEnv("ALERT_EMAIL_TO", "");
    expect(await emailIssues(newIssues([change], seed))).toEqual({ status: "not_configured" });
    expect(sendMail).not.toHaveBeenCalled();
  });
});
