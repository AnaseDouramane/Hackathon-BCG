import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearFailures,
  createSessionToken,
  isLockedOut,
  recordFailure,
  SESSION_MAX_AGE_S,
  verifyCredentials,
  verifySessionToken,
} from "@/lib/auth/session";

beforeEach(() => {
  vi.stubEnv("AUTH_USERNAME", "felix");
  vi.stubEnv("AUTH_PASSWORD", "secret-pass");
  vi.stubEnv("SESSION_SECRET", "a-long-random-session-secret");
});

describe("login", () => {
  it("accepts only the configured user and password", () => {
    expect(verifyCredentials("felix", "secret-pass")).toBe(true);
    expect(verifyCredentials("felix", "wrong")).toBe(false);
    expect(verifyCredentials("someone", "secret-pass")).toBe(false);
  });

  it("refuses everyone when no user is configured", () => {
    vi.stubEnv("AUTH_USERNAME", "");
    expect(verifyCredentials("", "")).toBe(false);
  });

  it("signs session tokens that expire and can't be forged", () => {
    const now = Date.now();
    const token = createSessionToken(now);
    expect(verifySessionToken(token, now)).toBe(true);
    expect(verifySessionToken(token, now + SESSION_MAX_AGE_S * 1000 + 1)).toBe(false);
    const [expires, signature] = token.split(".");
    expect(verifySessionToken(`${Number(expires) + 1000}.${signature}`, now)).toBe(false);
    expect(verifySessionToken(undefined, now)).toBe(false);
    vi.stubEnv("SESSION_SECRET", "another-secret");
    expect(verifySessionToken(token, now)).toBe(false);
  });

  it("locks out after 5 wrong attempts for 15 minutes", () => {
    const now = Date.now();
    for (let i = 0; i < 4; i++) recordFailure("1.2.3.4", now);
    expect(isLockedOut("1.2.3.4", now)).toBe(false);
    recordFailure("1.2.3.4", now);
    expect(isLockedOut("1.2.3.4", now)).toBe(true);
    expect(isLockedOut("1.2.3.4", now + 16 * 60 * 1000)).toBe(false);
    clearFailures("1.2.3.4");
    expect(isLockedOut("1.2.3.4", now)).toBe(false);
  });
});
