import { z } from "zod";
import {
  clearFailures,
  createSessionToken,
  isLockedOut,
  recordFailure,
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  verifyCredentials,
} from "@/lib/auth/session";

const LoginSchema = z.object({ username: z.string().max(100), password: z.string().max(200) });

const fail = (message: string, status: number) => Response.json({ error: "LOGIN_FAILED", message }, { status });

export async function POST(request: Request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isLockedOut(key)) return fail("Too many attempts. Try again in 15 minutes.", 429);

  const body = LoginSchema.safeParse(await request.json().catch(() => null));
  if (!body.success || !verifyCredentials(body.data.username, body.data.password)) {
    recordFailure(key);
    return fail("Wrong username or password.", 401);
  }

  clearFailures(key);
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "content-type": "application/json",
      "set-cookie": `${SESSION_COOKIE}=${createSessionToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MAX_AGE_S}${secure}`,
    },
  });
}
