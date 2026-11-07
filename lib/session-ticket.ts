import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

// Proof that a voice session was really started: the token route signs
// (user, interview, attempt) when it mints a Live token, and saveTranscript
// only accepts a transcript carrying a valid ticket for the attempt it would
// become. Without it, any browser could post a made-up transcript and get a
// scored report (and, with a verified email, a referral credit) without ever
// holding an interview. Stateless - no table needed.

// Long enough for a 30-40 min interview plus recovering an unsaved one
// after a crash or refresh.
export const TICKET_TTL_MS = 6 * 60 * 60 * 1000;

interface TicketPayload {
  u: string; // user id
  i: string; // interview id
  a: number; // attempt number this session would become
  t: number; // issued at (ms)
}

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET is not set");
  return value;
}

function sign(body: string): string {
  return createHmac("sha256", secret()).update(`session-ticket:${body}`).digest("base64url");
}

export function issueSessionTicket(userId: string, interviewId: string, attempt: number): string {
  const payload: TicketPayload = { u: userId, i: interviewId, a: attempt, t: Date.now() };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionTicket(
  ticket: unknown,
  expected: { userId: string; interviewId: string; attempt: number }
): boolean {
  if (typeof ticket !== "string" || ticket.length > 1024) return false;
  const [body, signature] = ticket.split(".");
  if (!body || !signature) return false;

  const want = Buffer.from(sign(body));
  const got = Buffer.from(signature);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TicketPayload;
    return (
      payload.u === expected.userId &&
      payload.i === expected.interviewId &&
      payload.a === expected.attempt &&
      typeof payload.t === "number" &&
      Date.now() - payload.t < TICKET_TTL_MS
    );
  } catch {
    return false;
  }
}
