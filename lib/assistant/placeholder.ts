// Assistente "placeholder": risponde con regole semplici sui dati reali dell'app,
// finché Claude non è collegato (vedi lib/assistant/claude.ts).
import type { CategoryFilter, ChatResponse, FieldSummary } from "@/lib/contract/schemas";
import { formatDue } from "@/lib/domain/format";
import { getNow } from "@/lib/now";
import { getFieldDetail, getStats, listFields } from "@/lib/services/fields";

type Reply = Omit<ChatResponse, "mode">;

const TOP = 3;

const fieldLink = (f: { id: string; code: string }) => ({ label: `Open ${f.code}`, href: `/fields/${f.id}` });

/** "KSG-001 Kaluluma West (Maize) — Fall armyworm outbreak → Scout 20 plants… (due today)" */
async function describeTopFields(fields: FieldSummary[]): Promise<string[]> {
  const now = getNow();
  return Promise.all(
    fields.slice(0, TOP).map(async (f, i) => {
      const detail = await getFieldDetail(f.id);
      const action = detail?.actions[0];
      const due = action?.dueAt ? ` (due ${formatDue(action.dueAt, now)})` : "";
      const todo = action ? ` → ${action.title}${due}` : "";
      return `${i + 1}. ${f.code} ${f.name} (${f.crop?.name ?? "no crop"}) — ${f.topAlert?.title ?? "no issues"}${todo}`;
    }),
  );
}

async function categoryAnswer(category: CategoryFilter, label: string): Promise<Reply> {
  const fields = await listFields({ category });
  if (fields.length === 0) return { reply: `No fields have ${label} issues right now.`, links: [] };
  const lines = await describeTopFields(fields);
  return {
    reply: [`${fields.length} fields have ${label} issues. The most important:`, ...lines].join("\n"),
    links: fields.slice(0, TOP).map(fieldLink),
  };
}

async function fieldAnswer(code: string): Promise<Reply> {
  const id = `fld_${code.padStart(3, "0")}`;
  const field = await getFieldDetail(id);
  if (!field) return { reply: `I can't find field KSG-${code.padStart(3, "0")}.`, links: [] };
  const now = getNow();
  const header = `${field.code} ${field.name} — ${field.crop?.name ?? "no crop"}, ${field.areaHa} ha, farmer ${field.farmer.name} (${field.farmer.phone}).`;
  if (field.alerts.length === 0) return { reply: `${header}\nNo open issues: the lamp is green.`, links: [fieldLink(field)] };
  const issues = field.alerts.map((a) => `• ${a.title}${a.isUrgent ? " (URGENT)" : ""}`);
  const actions = field.actions
    .slice(0, TOP)
    .map((a, i) => `${i + 1}. ${a.title}${a.dueAt ? ` (due ${formatDue(a.dueAt, now)})` : ""}`);
  return {
    reply: [header, "Open issues:", ...issues, "What to do first:", ...actions].join("\n"),
    links: [fieldLink(field)],
  };
}

async function overviewAnswer(): Promise<Reply> {
  const s = await getStats();
  return {
    reply:
      `Out of ${s.totalFields} fields: ${s.urgent} need action within 72 hours, ${s.disease} have disease risks, ` +
      `${s.fertilizer} need fertilizer, ${s.maturity} are close to harvest, and ${s.ok} have no issues.`,
    links: [{ label: "See urgent fields", href: "/issues/urgent" }],
  };
}

const HELP =
  "I'm a preview of the field assistant. Try asking:\n" +
  "• Where should I go first today?\n" +
  "• Which fields have disease problems?\n" +
  "• What should I do on KSG-003?\n" +
  "• What do the lamp colours mean?";

const LAMP =
  "Lamp colours: red = urgent (act within 72 hours), purple = disease risk, blue = fertilizer needed, " +
  "amber = harvest / maturity, green = no action needed. A lamp that alternates colours has several issues.";

export async function answerPlaceholder(question: string): Promise<Reply> {
  const q = question.toLowerCase();
  const code = question.match(/ksg[-\s]?(\d{1,3})/i)?.[1];

  if (code) return fieldAnswer(code);
  if (/lamp|light|colou?r/.test(q)) return { reply: LAMP, links: [] };
  if (/disease|pest|sick|armyworm|rust|virus|spot|shank/.test(q)) return categoryAnswer("disease", "disease");
  if (/fertili[sz]|nitrogen|urea|potassium|phosph|lime|\bph\b|soil/.test(q)) return categoryAnswer("fertilizer", "fertilizer");
  if (/harvest|matur|ripe|pick/.test(q)) return categoryAnswer("maturity", "harvest / maturity");
  if (/urgent|today|priorit|first|start|where|visit|go\b/.test(q)) {
    const answer = await categoryAnswer("urgent", "urgent");
    return { ...answer, reply: answer.reply.replace("have urgent issues", "need action within 72 hours") };
  }
  if (/how many|overview|summary|status|situation/.test(q)) return overviewAnswer();
  return { reply: HELP, links: [] };
}
