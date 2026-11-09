// Ownership, quota and privacy rules of the server actions, against a fake
// database (tests/helpers/fake-db.ts) - no real database is touched.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./helpers/fake-db";

const fake = vi.hoisted(() => ({ current: null as ReturnType<typeof createFakeDb> | null }));
const auth = vi.hoisted(() => ({ user: null as User | null }));
const limits = vi.hoisted(() => ({ ok: true }));

vi.mock("@/lib/db", async () => {
  const { createFakeDb } = await import("./helpers/fake-db");
  fake.current = createFakeDb();
  return { db: fake.current.db };
});
vi.mock("@/lib/actions/auth", () => ({ getCurrentUser: async () => auth.user }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: async () => ({ ok: limits.ok }) }));
vi.mock("@/lib/ai/generate", () => ({
  resilientGenerateObject: async () => ({ object: { questions: ["Problem A", "Problem B", "Problem C", "Problem D"] }, model: "test-model" }),
}));

const { saveTranscript } = await import("@/lib/actions/transcripts");
const { createFocusedInterview, deleteInterview, getCommunityInterviews, getInterview } = await import("@/lib/actions/interviews");
const { checkGenerationQuota } = await import("@/lib/generation-quota");
const { issueSessionTicket } = await import("@/lib/session-ticket");

const db = () => fake.current!;
const ME: User = { id: "user-me", name: "Me", email: "me@example.test", isPro: false };
const INTERVIEW = "11111111-1111-4111-8111-111111111111";
const answers = [1, 2, 3].flatMap((n) => [
  { role: "assistant" as const, content: `Question ${n}?` },
  { role: "user" as const, content: `Answer ${n}` },
]);

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret");
  vi.stubEnv("OWNER_EMAIL", "owner@example.test");
  db().reset();
  auth.user = ME;
  limits.ok = true;
});

describe("saveTranscript", () => {
  // Queries in order: the interview's owner, latest transcript attempt,
  // latest report attempt, then the insert.
  const ownInterview = () => db().queue([{ id: INTERVIEW, userId: ME.id }], [], []);

  it("saves a transcript carrying this attempt's ticket", async () => {
    ownInterview();
    db().queue([{ id: "t-1", attempt: 1 }]);
    const result = await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket: issueSessionTicket(ME.id, INTERVIEW, 1) });
    expect(result).toMatchObject({ success: true, attempt: 1 });
    expect(db().calls).toContain("insert");
  });

  it("refuses a transcript with no voice session behind it", async () => {
    ownInterview();
    const result = await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket: "" });
    expect(result).toMatchObject({ success: false, invalidSession: true });
    expect(db().calls).not.toContain("insert");
  });

  it("refuses a ticket minted for another user or attempt", async () => {
    ownInterview();
    const other = await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket: issueSessionTicket("someone-else", INTERVIEW, 1) });
    ownInterview();
    const stale = await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket: issueSessionTicket(ME.id, INTERVIEW, 2) });
    expect(other).toMatchObject({ success: false });
    expect(stale).toMatchObject({ success: false });
    expect(db().calls).not.toContain("insert");
  });

  it("refuses someone else's interview", async () => {
    db().queue([{ id: INTERVIEW, userId: "user-other" }]);
    const result = await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket: issueSessionTicket(ME.id, INTERVIEW, 1) });
    expect(result).toMatchObject({ success: false });
    expect(db().calls).not.toContain("insert");
  });

  it("refuses once the attempts are used up", async () => {
    db().queue([{ id: INTERVIEW, userId: ME.id }], [{ attempt: 3 }], []);
    const result = await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket: issueSessionTicket(ME.id, INTERVIEW, 4) });
    expect(result).toMatchObject({ success: false });
    expect(db().calls).not.toContain("insert");
  });

  it("keeps the code of a DSA round, and never stores code for other rounds", async () => {
    const ticket = issueSessionTicket(ME.id, INTERVIEW, 1);
    db().queue([{ id: INTERVIEW, userId: ME.id, format: "dsa" }], [], [], [{ id: "t-1", attempt: 1 }]);
    await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket, code: "def solve(): pass" });
    db().queue([{ id: INTERVIEW, userId: ME.id, format: "standard" }], [], [], [{ id: "t-2", attempt: 1 }]);
    await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket, code: "smuggled" });
    expect(db().inserted).toMatchObject([{ code: "def solve(): pass" }, { code: null }]);
  });

  it("doesn't use an attempt for fewer than 3 answers", async () => {
    const result = await saveTranscript({ interviewId: INTERVIEW, transcript: answers.slice(0, 4), ticket: issueSessionTicket(ME.id, INTERVIEW, 1) });
    expect(result).toMatchObject({ success: false, tooShort: true });
    expect(db().calls).toEqual([]);
  });

  it("refuses signed-out callers and malformed ids before touching the database", async () => {
    auth.user = null;
    expect(await saveTranscript({ interviewId: INTERVIEW, transcript: answers, ticket: "x" })).toMatchObject({ success: false });
    auth.user = ME;
    expect(await saveTranscript({ interviewId: "not-a-uuid", transcript: answers, ticket: "x" })).toMatchObject({ success: false });
    expect(db().calls).toEqual([]);
  });
});

describe("deleteInterview", () => {
  it("deletes your own interview", async () => {
    db().queue([{ userId: ME.id }], []);
    expect(await deleteInterview(INTERVIEW)).toEqual({ success: true });
    expect(db().calls).toContain("delete");
  });

  it("never deletes someone else's", async () => {
    db().queue([{ userId: "user-other" }]);
    expect(await deleteInterview(INTERVIEW)).toEqual({ success: false });
    expect(db().calls).not.toContain("delete");
  });
});

describe("interview privacy", () => {
  it("hides another user's questions, job description and resume", async () => {
    db().queue([{ id: INTERVIEW, userId: "user-other", questions: ["Tell me about Acme Corp"], jdText: "JD", resumeSnapshot: { summary: "x" }, fitSnapshot: null }]);
    const interview = await getInterview(INTERVIEW);
    expect(interview).toMatchObject({ questions: [], jdText: null, resumeSnapshot: null });
  });

  it("returns a malformed id as not found instead of crashing", async () => {
    expect(await getInterview("../etc")).toBeNull();
    expect(db().calls).toEqual([]);
  });

  it("community list carries only the public template fields", async () => {
    db().queue([{ id: INTERVIEW, role: "Dev", level: "junior", type: "technical", techstack: ["React"], userId: "user-other", createdAt: "2026-11-01" }]);
    const [interview] = (await getCommunityInterviews())!;
    expect(interview).toMatchObject({ questions: [], jdText: null, resumeSnapshot: null, fitSnapshot: null });
  });
});

describe("practice my gaps", () => {
  const SOURCE = "22222222-2222-4222-8222-222222222222";
  it("practises a DSA round as a DSA round, at the same difficulty and language", async () => {
    db().queue(
      [{ id: SOURCE, userId: ME.id, role: "SWE", level: "mid", type: "technical", format: "dsa", difficulty: "hard", language: "java", techstack: ["Java", "DSA"], questions: ["P1", "P2"], voice: null }],
      [{ areasForImprovement: ["Missed edge cases"], jdMatch: null, questionFeedback: [] }],
      [{ count: 1 }],
      [{ id: "new-id" }],
    );
    const result = await createFocusedInterview(SOURCE);
    expect(result).toMatchObject({ success: true, interviewId: "new-id" });
    const [row] = db().inserted as Array<Record<string, unknown>>;
    expect(row).toMatchObject({ format: "dsa", difficulty: "hard", language: "java" });
    // Same number of problems as the source (2), not the 5 standard focus questions.
    expect(row.questions).toEqual(["Problem A", "Problem B"]);
  });
});

describe("checkGenerationQuota", () => {
  it("allows a free user under the 5-interview limit", async () => {
    db().queue([{ count: 4 }]);
    expect(await checkGenerationQuota(ME)).toEqual({ ok: true });
  });

  it("blocks a free user at the limit", async () => {
    db().queue([{ count: 5 }]);
    expect(await checkGenerationQuota(ME)).toMatchObject({ ok: false, status: 403 });
  });

  it("gives Pro users 20", async () => {
    db().queue([{ count: 5 }]);
    expect(await checkGenerationQuota({ ...ME, isPro: true })).toEqual({ ok: true });
    db().queue([{ count: 20 }]);
    expect(await checkGenerationQuota({ ...ME, isPro: true })).toMatchObject({ ok: false, status: 403 });
  });

  it("enforces the hourly and daily rate limits before counting", async () => {
    limits.ok = false;
    expect(await checkGenerationQuota(ME)).toMatchObject({ ok: false, status: 429 });
    expect(db().calls).toEqual([]);
  });
});
