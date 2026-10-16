// Collegamento a Claude (prossimo passo). Oggi /api/chat usa answerPlaceholder().
//
// Per attivarlo:
//   1. npm install @anthropic-ai/sdk
//   2. ANTHROPIC_API_KEY in .env.local e nelle env di Vercel (mai nel codice)
//   3. togliere il commento a answerWithClaude() qui sotto e, in app/api/chat/route.ts,
//      usarla al posto di answerPlaceholder() quando la chiave è presente (mode: "claude").
//
// Il modello riceve i dati dei campi come contesto: risponde solo su quelli,
// e le diagnosi restano "suspected" come nell'app (spec §6.7).
import { formatDue } from "@/lib/domain/format";
import { getNow } from "@/lib/now";
import { getStats, listFields } from "@/lib/services/fields";

export const CLAUDE_MODEL = "claude-opus-5-5";

export const SYSTEM_PROMPT = `You are the field assistant of Felix, an agricultural extension officer in Kasungu, Malawi.
Answer questions about his fields using only the data in <field_data>. Be short and practical: plain English, at most a few lines or a short numbered list.
Always say which field (code and name) you mean. Sensor and drone findings are suspicions, not diagnoses: say "suspected" and suggest checking in the field.
If the data does not contain the answer, say so. Advice is simplified and must be validated by an agronomist.`;

/** Riassunto compatto dei campi con problemi, da passare a Claude come contesto. */
export async function buildAssistantContext(): Promise<string> {
  const now = getNow();
  const [stats, fields] = await Promise.all([getStats(), listFields()]);
  const lines = fields
    .filter((f) => f.topAlert)
    .map((f) => {
      const a = f.topAlert!;
      const due = a.dueAt ? `, due ${formatDue(a.dueAt, now)}` : "";
      const urgent = a.isUrgent ? " [URGENT]" : "";
      return `${f.code} ${f.name} | ${f.crop?.name} | ${f.farmerName} | ${a.category}: ${a.title}${urgent}${due} | ${f.openAlertsCount} open issue(s)`;
    });
  return [
    `Now: ${now.toISOString()}`,
    `Totals: ${JSON.stringify(stats)}`,
    "Fields with open issues, by priority:",
    ...lines,
  ].join("\n");
}

/*
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage } from "@/lib/contract/schemas";

const client = new Anthropic(); // legge ANTHROPIC_API_KEY

export async function answerWithClaude(messages: ChatMessage[]): Promise<string> {
  const context = await buildAssistantContext();
  const response = await client.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    // se un filtro di sicurezza rifiuta, la richiesta viene ripetuta su un altro modello
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: `${SYSTEM_PROMPT}\n\n<field_data>\n${context}\n</field_data>`,
    messages,
  });
  if (response.stop_reason === "refusal") return "Sorry, I can't help with that question.";
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
*/
