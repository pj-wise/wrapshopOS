import { describe, expect, it } from "vitest";

import { extractVariables, renderTemplate } from "@/lib/template-render";

describe("renderTemplate", () => {
  const ctx = {
    shop: { name: "Apex Restyling" },
    customer: { name: "Marcus Chen", firstName: "Marcus" },
    quote: { number: "Q-0042", total: "$4,200.00", portalUrl: "https://ws.local/q/abc" },
  };

  it("resolves nested paths", () => {
    expect(renderTemplate("Hi {{customer.firstName}}!", ctx)).toBe("Hi Marcus!");
  });

  it("escapes HTML by default", () => {
    expect(renderTemplate("Name: {{name}}", { name: "<script>alert(1)</script>" })).toBe(
      "Name: &lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("preserves raw HTML via triple braces", () => {
    expect(renderTemplate("Body: {{{html}}}", { html: "<b>bold</b>" })).toBe("Body: <b>bold</b>");
  });

  it("keeps unresolved placeholders visible", () => {
    expect(renderTemplate("Hi {{customer.middleName}}!", ctx)).toBe(
      "Hi {{customer.middleName}}!",
    );
  });

  it("handles multiple placeholders", () => {
    const html = renderTemplate(
      "Hi {{customer.firstName}}, quote {{quote.number}} is {{quote.total}}. View: {{{quote.portalUrl}}}",
      ctx,
    );
    expect(html).toBe(
      "Hi Marcus, quote Q-0042 is $4,200.00. View: https://ws.local/q/abc",
    );
  });
});

describe("extractVariables", () => {
  it("returns unique sorted paths", () => {
    const template =
      "Hi {{customer.firstName}}, {{shop.name}} sent quote {{quote.number}}. {{customer.firstName}} — {{{raw.value}}}";
    expect(extractVariables(template)).toEqual([
      "customer.firstName",
      "quote.number",
      "raw.value",
      "shop.name",
    ]);
  });
});
