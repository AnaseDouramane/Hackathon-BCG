// Collegamento a Claude per /api/chat. Attivo quando ANTHROPIC_API_KEY è impostata
// (in .env.local e nelle env di Vercel, mai nel codice); senza chiave risponde il placeholder.
//
// Il modello riceve i dati dei campi come contesto: risponde solo su quelli,
// e le diagnosi restano "suspected" come nell'app (spec §6.7).
import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ChatResponse } from "@/lib/contract/schemas";
import { formatDue } from "@/lib/domain/format";
import { getNow } from "@/lib/now";
import { getStats, listFields } from "@/lib/services/fields";

export const CLAUDE_MODEL = "claude-opus-5-5";

export const SYSTEM_PROMPT = `You are the field assistant of Felix, an agricultural extension officer in Kasungu, Malawi.
Answer questions about his fields using only the data in <field_data>. Be short and practical: plain English, at most a few lines or a short numbered list, no markdown headings or tables.
Always say which field (code and name) you mean. Sensor and drone findings are suspicions, not diagnoses: say "suspected" and suggest checking in the field.
If the data does not contain the answer, say so. Advice is simplified and must be validated by an agronomist.`;

const MAX_LINKS = 3;

export const isClaudeEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

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

/** Link ai campi citati nella risposta (codici che esistono davvero), nell'ordine in cui compaiono. */
export async function linksFromReply(reply: string): Promise<ChatResponse["links"]> {
  const idByCode = new Map((await listFields()).map((f) => [f.code.toUpperCase(), f.id]));
  const codes = [...new Set(reply.match(/\b[A-Z]{1,4}-?\d{1,3}\b/gi)?.map((c) => c.toUpperCase()) ?? [])];
  return codes
    .filter((code) => idByCode.has(code))
    .slice(0, MAX_LINKS)
    .map((code) => ({ label: `Open ${code}`, href: `/fields/${idByCode.get(code)}` }));
}

let client: Anthropic | null = null;

export async function answerWithClaude(messages: ChatMessage[]): Promise<string> {
  client ??= new Anthropic(); // legge ANTHROPIC_API_KEY
  const context = await buildAssistantContext();
  const response = await client.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    // chat: risposte brevi e veloci
    output_config: { effort: "low" },
    // se un filtro di sicurezza rifiuta, la richiesta viene ripetuta su un altro modello
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    // il contesto dei campi è uguale tra una domanda e l'altra: lo mettiamo in cache
    system: [
      {
        type: "text",
        text: `${SYSTEM_PROMPT}\n\n<field_data>\n${context}\n</field_data>`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });
  if (response.stop_reason === "refusal") return "Sorry, I can't help with that question.";
  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
