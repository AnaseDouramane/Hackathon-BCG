import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Transporter } from "nodemailer";
import { sendEmail, setTransporter } from "@/lib/email/send";
import { placeholdersOf, renderEmail } from "@/lib/email/template";

const template = { subject: "Alert {{field}}", body: "Hi {{name}},\n\ncheck {{field}} today." };

describe("renderEmail", () => {
  it("fills subject and body and escapes HTML", () => {
    const out = renderEmail(template, { field: "F01", name: "<Felix>" });
    expect(out.subject).toBe("Alert F01");
    expect(out.text).toContain("Hi <Felix>,");
    expect(out.html).toBe("<p>Hi &lt;Felix&gt;,</p><p>check F01 today.</p>");
  });

  it("refuses to render with a missing parameter", () => {
    expect(placeholdersOf(template)).toEqual(["field", "name"]);
    expect(() => renderEmail(template, { field: "F01" })).toThrow(/name/);
  });
});

describe("sendEmail", () => {
  const sendMail = vi.fn();
  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "smtp.test");
    vi.stubEnv("EMAIL_FROM", "felix@test.dev");
    sendMail.mockReset().mockResolvedValue({});
    setTransporter({ sendMail } as unknown as Transporter);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setTransporter(null);
  });

  it("sends one mail per unique recipient and reports failures", async () => {
    sendMail.mockRejectedValueOnce(new Error("boom"));
    const res = await sendEmail({
      recipients: ["a@x.com", "b@x.com", "a@x.com"],
      template,
      params: { field: "F01", name: "Felix" },
    });
    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(res.failed).toEqual([{ to: "a@x.com", error: "boom" }]);
    expect(res.sent).toEqual(["b@x.com"]);
  });

  it("rejects invalid addresses before sending anything", async () => {
    await expect(sendEmail({ recipients: ["nope"], template, params: { field: "F", name: "N" } })).rejects.toThrow(/Invalid/);
    expect(sendMail).not.toHaveBeenCalled();
  });
});
