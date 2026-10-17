import { describe, expect, it } from "vitest";
import { answerPlaceholder } from "@/lib/assistant/placeholder";

describe("assistant placeholder", () => {
  it("answers 'where first' with the urgent fields in priority order", async () => {
    const answer = await answerPlaceholder("Where should I go first today?");
    expect(answer.reply).toContain("8 fields need action within 72 hours");
    expect(answer.reply.indexOf("F13")).toBeLessThan(answer.reply.indexOf("F01"));
    expect(answer.links[0]).toEqual({ label: "Open F13", href: "/fields/F13" });
  });

  it("answers about a specific field with its first actions", async () => {
    const answer = await answerPlaceholder("What should I do on f1?");
    expect(answer.reply).toContain("Pick all red chillies within 48 hours");
    expect(answer.links).toEqual([{ label: "Open F01", href: "/fields/F01" }]);
  });

  it("explains the lamp colours and falls back to help", async () => {
    expect((await answerPlaceholder("what does the lamp colour mean")).reply).toContain("red = urgent");
    expect((await answerPlaceholder("hello")).reply).toContain("Try asking");
  });
});
