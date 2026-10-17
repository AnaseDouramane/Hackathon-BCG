// Port TS di tools/python/risk.py: Claude classifica i rischi di ogni campo a partire dalle evidenze.
// Stesse regole (nessun flag senza evidenza, Urgent solo con criticità immediata) e stessa validazione
// (_validate_result). Rispetto allo script: output strutturato, testi in inglese per la UI,
// azioni con scadenza, e le foto caricate passate come immagini.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CLAUDE_MODEL } from "@/lib/assistant/claude";

export const isRiskEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

const FLAGS = ["Urgent", "Fertilizer", "Disease", "Maturity"] as const;
const SEVERITIES = ["low", "moderate", "high", "critical"] as const;

const RiskAlertSchema = z.object({
  type: z.enum(FLAGS),
  severity: z.enum(SEVERITIES),
  title: z.string(),
  evidence: z.string(),
  rationale: z.string(),
  source: z.enum(["SENSOR", "DRONE", "WEATHER", "MANUAL"]),
  confidence: z.number(),
  actions: z.array(z.object({ title: z.string(), why: z.string(), due_in_days: z.number() })),
});

const RiskResultSchema = z.object({
  field_id: z.string(),
  flags: z.array(z.enum(FLAGS)),
  severity: z.enum(["none", ...SEVERITIES]),
  alerts: z.array(RiskAlertSchema),
  /** Cosa mostrano le foto del campo (vuoto se non ce ne sono). */
  photo_notes: z.string(),
});

const RiskResponseSchema = z.object({ results: z.array(RiskResultSchema) });

export type RiskFlag = (typeof FLAGS)[number];
export type RiskAlert = z.infer<typeof RiskAlertSchema>;
export type RiskResult = z.infer<typeof RiskResultSchema>;

export const RISK_SYSTEM_PROMPT = `You are a careful agronomic analyst for smallholder fields in Kasungu district, Malawi, working for an agricultural extension officer.
Assess only the JSON evidence provided for each field. Static characteristics (crop, coordinates, neighbours, names) do not prove a problem on their own. Do not invent diagnoses, alerts, deficiencies, growth stages or actions that already happened.
- Disease requires an observed disease or pest, or an explicit diagnostic result (field report, drone finding, photo identification).
- Fertilizer requires an explicit soil or nutrient problem, or fertilization evidence.
- Maturity requires an observed growth stage or harvest readiness.
- Urgent is assigned only with evidence of immediate criticality, for example a severe disease together with a relevant active weather alert, a ripe crop with heavy rain forecast within 72 hours, or another explicit emergency. A generic forecast or weather condition is not enough.
If evidence is missing, flags must be []. Severity is the highest risk supported by the evidence; "none" if there are no flags.

How the app shows your output:
- One alert per type per field. Every flag must be justified by an alert of that type, and evidence must cite a fact present in the data (values, dates, findings), not a hypothesis.
- For Urgent, also set severity "critical" on the alert of the problem that is urgent.
- title: short plain English (at most ~70 characters), what the officer reads in a list. When a disease is only inferred from sensor or weather conditions, the title must start with "Conditions favourable to".
- Sensor, drone and photo findings are suspicions, not diagnoses: say "suspected" where it applies and suggest checking in the field.
- source: the evidence the alert mainly rests on: SENSOR (soil sensors and sensor-based reports), DRONE (drone imagery), WEATHER (driven by the forecast), MANUAL (field visit or an uploaded photo).
- confidence: 0 to 1. Reuse the confidence of the field report or the photo identification probability when given.
- actions: 1 to 3 practical steps in priority order, each with why and due_in_days (0 = today), simple enough for a smallholder farmer.
- photo_notes: when photos of the field are attached, describe in one or two sentences what they show (crop, growth stage, ripeness, visible symptoms); otherwise an empty string. Earlier photos are summarised in observations.photos.
- Keep the wording and severity of existing field reports unless new evidence (forecast, fertilizer plan, photos) changes the picture, and say so in the rationale when it does.
Every field in the request must appear exactly once in results.`;

/** Port di _validate_result: scarta alert senza evidenza e flag non giustificati da un alert. */
export function validateResult(result: RiskResult): RiskResult {
  const alerts = result.alerts
    .filter((a) => a.evidence.trim() !== "")
    .map((a) => ({ ...a, confidence: Math.min(1, Math.max(0, a.confidence)), actions: a.actions.slice(0, 3) }));
  const backed = new Set(alerts.map((a) => a.type));
  const flags = [...new Set([...result.flags.filter((f) => backed.has(f)), ...backed])];
  return { ...result, flags, severity: flags.length ? result.severity : "none", alerts };
}

export type RiskImage = { fieldId: string; base64: string; mediaType: "image/jpeg" | "image/png" | "image/webp" };

let client: Anthropic | null = null;

/** Classifica un gruppo di campi (in risk.py: un batch). Lancia un errore se la risposta è incompleta. */
export async function classifyFields(fields: { field: { field_id: string } }[], now: Date, images: RiskImage[] = []): Promise<RiskResult[]> {
  client ??= new Anthropic(); // legge ANTHROPIC_API_KEY
  const imageBlocks = images.flatMap((img) => [
    { type: "text" as const, text: `Photo uploaded for field ${img.fieldId}:` },
    { type: "image" as const, source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 } },
  ]);
  const response = await client.beta.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 16000,
    // classificazione: bassa latenza
    output_config: { effort: "low", format: betaZodOutputFormat(RiskResponseSchema) },
    // se un filtro di sicurezza rifiuta, la richiesta viene ripetuta su un altro modello
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: RISK_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          ...imageBlocks,
          {
            type: "text",
            text: `Now: ${now.toISOString()}\nAnalyse these fields and return the results:\n${JSON.stringify(fields)}`,
          },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("Claude declined the risk analysis");
  if (response.stop_reason === "max_tokens") throw new Error("Claude risk analysis was cut off (max_tokens)");
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Claude did not return valid JSON for the risk analysis");

  // A differenza di risk.py un campo mancante non invalida il gruppo: chi chiama riprova solo quelli.
  const expected = new Set(fields.map((f) => f.field.field_id));
  const out = new Map<string, RiskResult>();
  for (const raw of parsed.results) {
    if (expected.has(raw.field_id) && !out.has(raw.field_id)) out.set(raw.field_id, validateResult(raw));
  }
  return [...out.values()];
}
