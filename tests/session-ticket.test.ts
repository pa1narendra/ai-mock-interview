import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { issueSessionTicket, TICKET_TTL_MS, verifySessionTicket } from "@/lib/session-ticket";

const expected = { userId: "user-1", interviewId: "interview-1", attempt: 2 };

describe("session tickets", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("accepts a ticket for the same user, interview and attempt", () => {
    expect(verifySessionTicket(issueSessionTicket("user-1", "interview-1", 2), expected)).toBe(true);
  });

  it("rejects another user, interview or attempt", () => {
    const ticket = issueSessionTicket("user-1", "interview-1", 2);
    expect(verifySessionTicket(ticket, { ...expected, userId: "user-2" })).toBe(false);
    expect(verifySessionTicket(ticket, { ...expected, interviewId: "interview-2" })).toBe(false);
    // Replaying it for the next attempt once this one is saved.
    expect(verifySessionTicket(ticket, { ...expected, attempt: 3 })).toBe(false);
  });

  it("rejects a forged or tampered ticket", () => {
    const [, signature] = issueSessionTicket("user-1", "interview-1", 2).split(".");
    const forged = Buffer.from(JSON.stringify({ u: "user-1", i: "interview-1", a: 2, t: Date.now() - 1000 })).toString("base64url");
    expect(verifySessionTicket(`${forged}.${signature}`, expected)).toBe(false);
    expect(verifySessionTicket(`${forged}.bad`, expected)).toBe(false);
    expect(verifySessionTicket("", expected)).toBe(false);
    expect(verifySessionTicket(undefined, expected)).toBe(false);
  });

  it("rejects a ticket signed with another secret", () => {
    const ticket = issueSessionTicket("user-1", "interview-1", 2);
    vi.stubEnv("BETTER_AUTH_SECRET", "other-secret");
    expect(verifySessionTicket(ticket, expected)).toBe(false);
  });

  it("expires", () => {
    vi.useFakeTimers();
    const ticket = issueSessionTicket("user-1", "interview-1", 2);
    vi.advanceTimersByTime(TICKET_TTL_MS + 1);
    expect(verifySessionTicket(ticket, expected)).toBe(false);
  });
});
