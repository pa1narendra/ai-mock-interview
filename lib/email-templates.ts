import "server-only";

// Transactional emails (verify email, reset password). Email clients ignore
// <style> blocks and modern CSS, so the HTML is a single centred table with
// inline styles. Every email also has a plain-text version for clients that
// don't render HTML, and the raw link stays visible as a fallback.

const BRAND = "#7440e0";
const INK = "#10131a";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ActionEmail {
  preheader: string; // inbox preview line
  heading: string;
  greetingName: string;
  intro: string;
  buttonLabel: string;
  url: string;
  expiry: string; // e.g. "This link expires in 24 hours."
  reason: string; // why they got it / what to do if it wasn't them
}

export function actionEmail(email: ActionEmail): { html: string; text: string } {
  const name = escapeHtml(email.greetingName);
  const url = escapeHtml(email.url);

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(email.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f5f7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(email.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid ${LINE};border-radius:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr><td style="padding:28px 32px 0;">
        <span style="font-size:20px;font-weight:700;letter-spacing:-0.3px;color:${INK};">mockstar</span><span style="color:${BRAND};font-size:20px;font-weight:700;">.</span>
      </td></tr>
      <tr><td style="padding:24px 32px 0;">
        <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;color:${INK};">${escapeHtml(email.heading)}</h1>
        <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${INK};">Hi ${name},</p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(email.intro)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="border-radius:999px;background:${BRAND};">
            <a href="${url}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px;">${escapeHtml(email.buttonLabel)}</a>
          </td>
        </tr></table>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(email.expiry)}</p>
      </td></tr>
      <tr><td style="padding:24px 32px 0;">
        <p style="margin:0;font-size:12px;line-height:1.6;color:${MUTED};">Button not working? Copy this link into your browser:</p>
        <p style="margin:4px 0 0;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${url}" style="color:${BRAND};">${url}</a></p>
      </td></tr>
      <tr><td style="padding:24px 32px 28px;">
        <p style="margin:0;padding-top:20px;border-top:1px solid ${LINE};font-size:12px;line-height:1.6;color:${MUTED};">${escapeHtml(email.reason)}</p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:${MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Mockstar · practise interviews out loud</p>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    `Hi ${email.greetingName},`,
    "",
    email.intro,
    "",
    `${email.buttonLabel}: ${email.url}`,
    "",
    email.expiry,
    "",
    email.reason,
    "",
    "- Mockstar",
  ].join("\n");

  return { html, text };
}
