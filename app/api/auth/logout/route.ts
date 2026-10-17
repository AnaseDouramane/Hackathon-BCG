import { SESSION_COOKIE } from "@/lib/auth/session";

export async function POST(request: Request) {
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL("/login", request.url).toString(),
      "set-cookie": `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`,
    },
  });
}
