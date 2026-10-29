import { describe, expect, it } from "vitest";
import { interviewRequestSchema, reportSchema, questionFeedbackSchema, MAX_INTERVIEW_ATTEMPTS, transcriptSchema, countUserTurns, MIN_USER_TURNS_FOR_REFERRAL } from "@/lib/schemas";

const base = {
  role: "Frontend Developer",
  level: "mid",
  type: "mixed",
  techstack: "React, TypeScript",
  amount: 5,
  jd: "",
};

describe("interviewRequestSchema", () => {
  it("accepts a valid quick-mode request", () => {
    expect(interviewRequestSchema.safeParse(base).success).toBe(true);
  });

  it("requires a techstack OR a job description", () => {
    expect(interviewRequestSchema.safeParse({ ...base, techstack: "" }).success).toBe(false);
    expect(
      interviewRequestSchema.safeParse({ ...base, techstack: "", jd: "We need a React dev." }).success
    ).toBe(true);
  });

  it("coerces FormData string values", () => {
    const parsed = interviewRequestSchema.safeParse({ ...base, amount: "7", useSavedResume: "true" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(7);
      expect(parsed.data.useSavedResume).toBe(true);
    }
  });

  it("bounds the question count to 1-20", () => {
    expect(interviewRequestSchema.safeParse({ ...base, amount: 0 }).success).toBe(false);
    expect(interviewRequestSchema.safeParse({ ...base, amount: 21 }).success).toBe(false);
    expect(interviewRequestSchema.safeParse({ ...base, amount: 20 }).success).toBe(true);
  });

  it("rejects an oversized job description", () => {
    expect(interviewRequestSchema.safeParse({ ...base, jd: "x".repeat(15_001) }).success).toBe(false);
  });

  it("rejects missing/short role", () => {
    expect(interviewRequestSchema.safeParse({ ...base, role: "x" }).success).toBe(false);
  });
});

describe("reportSchema", () => {
  const category = { name: "Communication Skills", score: 70, comment: "ok" };
  const validReport = {
    totalScore: 70,
    categoryScores: Array.from({ length: 5 }, () => category),
    strengths: ["clear"],
    areasForImprovement: ["depth"],
    finalAssessment: "Decent.",
  };

  it("accepts exactly five categories", () => {
    expect(reportSchema.safeParse(validReport).success).toBe(true);
  });

  it("rejects four or six categories", () => {
    expect(
      reportSchema.safeParse({ ...validReport, categoryScores: Array.from({ length: 4 }, () => category) }).success
    ).toBe(false);
    expect(
      reportSchema.safeParse({ ...validReport, categoryScores: Array.from({ length: 6 }, () => category) }).success
    ).toBe(false);
  });
});

describe("questionFeedbackSchema", () => {
  it("accepts an array of per-question feedback entries", () => {
    const parsed = questionFeedbackSchema.safeParse([
      { question: "Tell me about yourself", answerSummary: "Gave a concise overview", score: 72, feedback: "Good, add metrics", idealAnswer: "Lead with impact" },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("accepts an empty array (interviewer never got to any question)", () => {
    expect(questionFeedbackSchema.safeParse([]).success).toBe(true);
  });

  it("rejects entries missing required fields", () => {
    expect(questionFeedbackSchema.safeParse([{ question: "x", score: 50 }]).success).toBe(false);
  });
});

describe("constants", () => {
  it("attempt limit is a small positive integer", () => {
    expect(MAX_INTERVIEW_ATTEMPTS).toBeGreaterThan(0);
    expect(Number.isInteger(MAX_INTERVIEW_ATTEMPTS)).toBe(true);
  });
});

describe("transcriptSchema", () => {
  it("accepts a normal transcript", () => {
    const result = transcriptSchema.safeParse([
      { role: "assistant", content: "Tell me about yourself" },
      { role: "user", content: "I build web apps" },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects empty, oversized, or malformed transcripts", () => {
    expect(transcriptSchema.safeParse([]).success).toBe(false);
    expect(transcriptSchema.safeParse([{ role: "system", content: "x" }]).success).toBe(false);
    expect(transcriptSchema.safeParse([{ role: "user", content: "x".repeat(10_001) }]).success).toBe(false);
    expect(transcriptSchema.safeParse(Array(501).fill({ role: "user", content: "x" })).success).toBe(false);
  });
});

describe("countUserTurns", () => {
  it("counts only non-empty candidate turns", () => {
    expect(countUserTurns([
      { role: "assistant", content: "Q1" },
      { role: "user", content: "answer" },
      { role: "user", content: "   " },
      { role: "user", content: "another" },
    ])).toBe(2);
  });

  it("keeps a one-line 'hi' below the referral threshold", () => {
    expect(countUserTurns([{ role: "user", content: "hi" }])).toBeLessThan(MIN_USER_TURNS_FOR_REFERRAL);
  });
});
