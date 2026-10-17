import { apiError, withErrors } from "@/lib/api";
import { answerWithClaude, isClaudeEnabled, linksFromReply } from "@/lib/assistant/claude";
import { answerPlaceholder } from "@/lib/assistant/placeholder";
import { type ChatMessage, type ChatResponse, ChatRequestSchema } from "@/lib/contract/schemas";

// Assistente della dashboard (spec §7.7). Con ANTHROPIC_API_KEY risponde Claude;
// senza chiave, o se Claude non risponde, il placeholder (la demo non si blocca mai).
export async function POST(request: Request) {
  return withErrors(async () => {
    const body = ChatRequestSchema.safeParse(await request.json().catch(() => null));
    const question = body.success ? body.data.messages.at(-1) : undefined;
    if (!body.success || question?.role !== "user") {
      return apiError("INVALID_QUERY", "Send { messages: [...] } ending with a user message");
    }
    if (isClaudeEnabled()) {
      const answer = await askClaude(body.data.messages);
      if (answer) return Response.json(answer satisfies ChatResponse);
    }
    const answer = await answerPlaceholder(question.content);
    return Response.json({ ...answer, mode: "placeholder" } satisfies ChatResponse);
  });
}

async function askClaude(messages: ChatMessage[]): Promise<ChatResponse | null> {
  try {
    const reply = await answerWithClaude(messages);
    return { reply, links: await linksFromReply(reply), mode: "claude" };
  } catch (err) {
    console.error("Claude unavailable, falling back to placeholder:", err);
    return null;
  }
}
