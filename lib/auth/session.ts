// Sessione del login (usata da app/api/auth/*, proxy.ts e dalle Server Action).
// Un solo utente demo dalle env (AUTH_USERNAME / AUTH_PASSWORD); il cookie è "scadenza.firma",
// firmato con HMAC-SHA256 su SESSION_SECRET: senza segreto nessun token è valido.
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "felix_session";
export const SESSION_MAX_AGE_S = 8 * 60 * 60;

const MAX_FAILURES = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const secret = () => process.env.SESSION_SECRET ?? "";

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function verifyCredentials(username: string, password: string): boolean {
  const user = process.env.AUTH_USERNAME;
  const pass = process.env.AUTH_PASSWORD;
  if (!user || !pass) return false;
  // tutte e due le verifiche, sempre: il tempo di risposta non dice quale delle due è sbagliata
  const okUser = safeEqual(username, user);
  const okPass = safeEqual(password, pass);
  return okUser && okPass;
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function createSessionToken(now = Date.now()): string {
  if (!secret()) throw new Error("SESSION_SECRET is not set");
  const expires = String(now + SESSION_MAX_AGE_S * 1000);
  return `${expires}.${sign(expires)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): boolean {
  if (!token || !secret()) return false;
  const [expires, signature] = token.split(".");
  if (!expires || !signature || !safeEqual(signature, sign(expires))) return false;
  return Number(expires) > now;
}

// Tentativi falliti per IP, in memoria (per istanza): basta per frenare i tentativi ripetuti nella demo.
const failures = new Map<string, { count: number; until: number }>();

export function isLockedOut(key: string, now = Date.now()): boolean {
  const entry = failures.get(key);
  return Boolean(entry && entry.count >= MAX_FAILURES && entry.until > now);
}

export function recordFailure(key: string, now = Date.now()): void {
  const entry = failures.get(key);
  const count = entry && entry.until > now ? entry.count + 1 : 1;
  failures.set(key, { count, until: now + LOCKOUT_MS });
}

export function clearFailures(key: string): void {
  failures.delete(key);
}
