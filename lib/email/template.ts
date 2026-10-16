// Template parametrico per le email: oggetto e corpo con segnaposto {{nome}}.
export type EmailTemplate = { subject: string; body: string };
export type EmailParams = Record<string, string | number>;

const PLACEHOLDER = /\{\{\s*(\w+)\s*\}\}/g;

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Segnaposto presenti nel template (senza duplicati). */
export function placeholdersOf(template: EmailTemplate): string[] {
  return [...new Set([...`${template.subject}\n${template.body}`.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

function fill(text: string, params: EmailParams, escape: (s: string) => string): string {
  return text.replace(PLACEHOLDER, (_, key: string) => escape(String(params[key])));
}

/** Compila oggetto e corpo (testo + HTML). Lancia se manca un parametro, così non parte mai una mail con "{{...}}". */
export function renderEmail(template: EmailTemplate, params: EmailParams) {
  const missing = placeholdersOf(template).filter((key) => params[key] === undefined);
  if (missing.length) throw new Error(`Missing email parameters: ${missing.join(", ")}`);
  const html = fill(template.body, params, escapeHtml)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return {
    subject: fill(template.subject, params, (s) => s),
    text: fill(template.body, params, (s) => s),
    html,
  };
}
