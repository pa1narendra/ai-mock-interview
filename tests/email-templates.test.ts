import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { actionEmail } = await import("@/lib/email-templates");

const base = {
  preheader: "Preview",
  heading: "Confirm your email",
  greetingName: "Pavan",
  intro: "Confirm your address.",
  buttonLabel: "Confirm email",
  url: "https://example.com/api/auth/verify-email?token=abc&callbackURL=%2Fdashboard",
  expiry: "This link expires in 24 hours.",
  reason: "You signed up.",
};

describe("actionEmail", () => {
  it("puts the link in the button, the fallback and the plain-text version", () => {
    const { html, text } = actionEmail(base);
    expect(html).toContain('href="https://example.com/api/auth/verify-email?token=abc&amp;callbackURL=%2Fdashboard"');
    expect(text).toContain(base.url);
    expect(text).toContain("Hi Pavan,");
  });

  it("escapes user-controlled names so they can't inject HTML", () => {
    const { html } = actionEmail({ ...base, greetingName: '<a href="https://evil.example">Click</a>' });
    expect(html).not.toContain('<a href="https://evil.example">');
    expect(html).toContain("&lt;a href=&quot;https://evil.example&quot;&gt;");
  });
});
