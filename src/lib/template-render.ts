/**
 * Mustache-safe template renderer for shop messages.
 *
 * Accepts `{{path.to.value}}` placeholders and resolves them against a bounded
 * `context` object. Values are HTML-escaped by default; `{{{path}}}` (triple)
 * bypasses escaping for pre-sanitized HTML.
 *
 * Deliberately does NOT support:
 *   - conditionals, loops, partials, helpers, functions
 *   - arbitrary JS
 *
 * Undefined values become the literal `{{path}}` back so shops notice a typo
 * rather than accidentally sending an empty field to a customer.
 */

export type TemplateContext = Record<string, unknown>;

// The variables shops can rely on. Also serves as documentation for the UI.
export const TEMPLATE_VARIABLES = [
  { path: "shop.name", label: "Shop name" },
  { path: "customer.name", label: "Customer name" },
  { path: "customer.firstName", label: "Customer first name" },
  { path: "quote.number", label: "Quote number (e.g. Q-0042)" },
  { path: "quote.total", label: "Quote total formatted" },
  { path: "quote.portalUrl", label: "Customer portal URL for quote" },
  { path: "job.number", label: "Job number (e.g. J-0042)" },
  { path: "job.scheduledDate", label: "Scheduled date formatted" },
  { path: "invoice.number", label: "Invoice number" },
  { path: "invoice.total", label: "Invoice total formatted" },
  { path: "invoice.payLinkUrl", label: "QuickBooks pay link" },
] as const;

const HTML_ESCAPE_MAP: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function htmlEscape(input: string): string {
  return input.replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

function resolvePath(ctx: TemplateContext, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(
    // {{{path}}} = raw; {{path}} = escaped. Path may include dots + underscores.
    /\{\{\{?\s*([a-zA-Z0-9_.]+)\s*\}?\}\}/g,
    (match, path: string) => {
      const value = resolvePath(context, path);
      if (value == null || value === "") return match; // preserve as-is
      const str = String(value);
      const raw = match.startsWith("{{{");
      return raw ? str : htmlEscape(str);
    },
  );
}

/**
 * Extract variable paths used in a template. Useful for listing what a template
 * needs at render time.
 */
export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  const re = /\{\{\{?\s*([a-zA-Z0-9_.]+)\s*\}?\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(template)) !== null) {
    if (m[1]) found.add(m[1]);
  }
  return Array.from(found).sort();
}
