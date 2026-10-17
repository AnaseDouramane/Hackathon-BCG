// Login obbligatorio: senza cookie di sessione valido le pagine portano a /login e le API rispondono 401.
// Restano libere la pagina di login, le sue API, /api/email/send (ha già il suo secret) e i file statici.
import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

export function proxy(request: NextRequest) {
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return Response.json({ error: "UNAUTHORIZED", message: "Sign in first" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: [
    "/((?!login|api/auth|api/email/send|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)",
  ],
};
