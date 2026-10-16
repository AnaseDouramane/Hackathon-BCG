import { apiError, withErrors } from "@/lib/api";
import { answerPlaceholder } from "@/lib/assistant/placeholder";
import { type ChatResponse, ChatRequestSchema } from "@/lib/contract/schemas";

// Assistente della dashboard (spec §7.7). Per ora risponde il placeholder;
// per collegare Claude vedi lib/assistant/claude.ts.
export async function POST(request: Request) {
  return withErrors(async () => {
    const body = ChatRequestSchema.safeParse(await request.json().catch(() => null));
    const question = body.success ? body.data.messages.at(-1) : undefined;
    if (!body.success || question?.role !== "user") {
      return apiError("INVALID_QUERY", "Send { messages: [...] } ending with a user message");
    }
    const answer = await answerPlaceholder(question.content);
    return Response.json({ ...answer, mode: "placeholder" } satisfies ChatResponse);
  });
}
