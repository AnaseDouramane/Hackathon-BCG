import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/chat/route";
import { linksFromReply } from "@/lib/assistant/claude";

const ask = (body: unknown) =>
  POST(new Request("http://localhost/api/chat", { method: "POST", body: JSON.stringify(body) }));

describe("POST /api/chat", () => {
  beforeEach(() => vi.stubEnv("ANTHROPIC_API_KEY", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("answers with the placeholder when Claude has no key", async () => {
    const res = await ask({ messages: [{ role: "user", content: "Where should I go first today?" }] });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.mode).toBe("placeholder");
    expect(data.links.length).toBeGreaterThan(0);
  });

  it("rejects a conversation that does not end with a user message", async () => {
    const res = await ask({ messages: [{ role: "assistant", content: "Hi" }] });
    expect(res.status).toBe(400);
  });
});

describe("linksFromReply", () => {
  it("links only codes of real fields, once, in order", async () => {
    const links = await linksFromReply("Go to F01 first, then F13. F01 again; F999 does not exist.");
    expect(links.map((l) => l.label)).toEqual(["Open F01", "Open F13"]);
    expect(links[0].href).toBe("/fields/F01");
  });
});
