import "server-only";

import { after } from "next/server";

// Minimal email sender via the Resend REST API (free tier: resend.com).
// Without RESEND_API_KEY the email is logged to the server console instead,
// so the reset flow stays usable in local development.
export async function sendEmail(params: { to: string; subject: string; text: string; html?: string }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn(
      `[email fallback - RESEND_API_KEY not set]\nTo: ${params.to}\nSubject: ${params.subject}\n${params.text}`
    );
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Mockstar <onboarding@resend.dev>",
      to: [params.to],
      subject: params.subject,
      text: params.text,
      ...(params.html ? { html: params.html } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body.slice(0, 300)}`);
  }
}

// Sends after the response has gone out, so sign-up, sign-in and password
// reset don't wait on Resend. Failures are logged - the user can always hit
// "Resend email". Falls back to sending in place outside a request (tests,
// scripts), where after() isn't available.
export function sendEmailInBackground(params: Parameters<typeof sendEmail>[0]) {
  const send = () =>
    sendEmail(params).catch((error) => console.error("email send failed", params.subject, error));
  try {
    after(send);
  } catch {
    void send();
  }
}
