import { z } from "zod";
import { apiError, withErrors } from "@/lib/api";
import { sendEmail } from "@/lib/email/send";

const SendEmailRequestSchema = z.object({
  recipients: z.array(z.string()).min(1).max(100),
  template: z.object({ subject: z.string().min(1), body: z.string().min(1) }),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});

// Trigger dell'invio email. Protetto da EMAIL_TRIGGER_SECRET (header "Authorization: Bearer <secret>"):
// senza segreto configurato la route è chiusa, per non diventare un relay di spam.
export async function POST(request: Request) {
  return withErrors(async () => {
    const secret = process.env.EMAIL_TRIGGER_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
      return Response.json({ error: "UNAUTHORIZED", message: "Missing or wrong secret" }, { status: 401 });
    }
    const body = SendEmailRequestSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return apiError("INVALID_QUERY", "Send { recipients: [...], template: { subject, body }, params? }");
    try {
      return Response.json(await sendEmail(body.data));
    } catch (err) {
      return apiError("INVALID_QUERY", err instanceof Error ? err.message : "Could not send");
    }
  });
}
