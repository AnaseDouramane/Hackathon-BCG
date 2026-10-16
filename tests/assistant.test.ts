import { describe, expect, it } from "vitest";
import { answerPlaceholder } from "@/lib/assistant/placeholder";

describe("assistant placeholder", () => {
  it("answers 'where first' with the urgent fields in priority order", async () => {
    const answer = await answerPlaceholder("Where should I go first today?");
    expect(answer.reply).toContain("8 fields need action within 72 hours");
    expect(answer.reply.indexOf("KSG-001")).toBeLessThan(answer.reply.indexOf("KSG-003"));
    expect(answer.links[0]).toEqual({ label: "Open KSG-001", href: "/fields/fld_001" });
  });

  it("answers about a specific field with its first actions", async () => {
    const answer = await answerPlaceholder("What should I do on KSG-003?");
    expect(answer.reply).toContain("Lift groundnuts within 48 hours");
    expect(answer.links).toEqual([{ label: "Open KSG-003", href: "/fields/fld_003" }]);
  });

  it("explains the lamp colours and falls back to help", async () => {
    expect((await answerPlaceholder("what does the lamp colour mean")).reply).toContain("red = urgent");
    expect((await answerPlaceholder("hello")).reply).toContain("Try asking");
  });
});
