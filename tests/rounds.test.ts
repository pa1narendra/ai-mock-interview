// DSA and system design rounds: request limits, prompts and the scoring rubric.

import { describe, expect, it } from "vitest";
import { interviewRequestSchema, ROUND_LIMITS } from "@/lib/schemas";
import { buildInterviewerPrompt, buildRoundPrompt } from "@/lib/ai/prompts";
import {
  applyScoringRules,
  buildScoringPrompt,
  categoriesFor,
  categoryScoresFromAnswers,
  MISTAKE_CAP,
  scoringSchema,
} from "@/lib/ai/scoring";

const request = { role: "Backend Engineer", level: "mid", type: "technical" };

describe("round requests", () => {
  it("plans 1-3 coding problems, not the standard 15+", () => {
    const dsa = { ...request, format: "dsa", difficulty: "medium", language: "python" };
    expect(interviewRequestSchema.safeParse({ ...dsa, amount: 2 }).success).toBe(true);
    expect(interviewRequestSchema.safeParse({ ...dsa, amount: 4 }).success).toBe(false);
    expect(interviewRequestSchema.safeParse({ ...dsa, amount: 15 }).success).toBe(false);
  });

  it("plans 1-2 system design prompts", () => {
    const sd = { ...request, format: "system_design" };
    expect(interviewRequestSchema.safeParse({ ...sd, amount: 1 }).success).toBe(true);
    expect(interviewRequestSchema.safeParse({ ...sd, amount: 3 }).success).toBe(false);
  });

  it("needs a difficulty and a language for DSA, but no tech stack or JD", () => {
    expect(interviewRequestSchema.safeParse({ ...request, format: "dsa", amount: 2 }).success).toBe(false);
    expect(interviewRequestSchema.safeParse({ ...request, format: "dsa", amount: 2, difficulty: "hard", language: "cpp" }).success).toBe(true);
  });

  it("keeps the standard rules for standard interviews", () => {
    expect(interviewRequestSchema.safeParse({ ...request, techstack: "Go", amount: ROUND_LIMITS.standard.min }).success).toBe(true);
    expect(interviewRequestSchema.safeParse({ ...request, techstack: "Go", amount: 3 }).success).toBe(false);
    expect(interviewRequestSchema.safeParse({ ...request, amount: 15 }).success).toBe(false); // no stack or JD
  });
});

describe("round prompts", () => {
  const interview: Interview = {
    id: "i", role: "Backend Engineer", level: "mid", type: "technical", techstack: ["Python"], userId: "u", createdAt: "",
    format: "dsa", difficulty: "medium", language: "python",
    questions: ["Title: Two Sum\nFind two indices that add up to target.", "Title: Valid Parentheses\nCheck the brackets."],
  };

  it("DSA interviewer reads the editor through get_candidate_code and shows problems with start_problem", () => {
    const prompt = buildInterviewerPrompt(interview, "Asha");
    expect(prompt).toContain("get_candidate_code");
    expect(prompt).toContain("start_problem");
    expect(prompt).toContain("Python");
    expect(prompt).toContain("Two Sum");
    expect(prompt).toContain("end_interview");
    expect(prompt).not.toContain("numbered questions"); // not the standard script
  });

  it("system design interviewer walks requirements to trade-offs, without the code tool", () => {
    const prompt = buildInterviewerPrompt({ ...interview, format: "system_design", questions: ["Title: URL shortener"] }, "Asha");
    expect(prompt).toContain("Requirements");
    expect(prompt).toContain("Trade-offs");
    expect(prompt).toContain("start_problem");
    expect(prompt).not.toContain("get_candidate_code");
  });

  it("a standard interview keeps the standard script", () => {
    const prompt = buildInterviewerPrompt({ ...interview, format: "standard" }, "Asha");
    expect(prompt).toContain("numbered questions");
    expect(prompt).not.toContain("start_problem");
  });

  it("generation asks for the difficulty, language and count, and targets weak areas when practising gaps", () => {
    const prompt = buildRoundPrompt({ format: "dsa", role: "SWE", level: "junior", amount: 2, difficulty: "hard", language: "java", focus: ["Missed the empty-array edge case"] });
    expect(prompt).toContain("exactly 2");
    expect(prompt).toContain("hard");
    expect(prompt).toContain("Java");
    expect(prompt).toContain("Missed the empty-array edge case");
    expect(buildRoundPrompt({ format: "system_design", role: "SWE", level: "senior", amount: 1 })).toContain("system design");
  });
});

describe("DSA scoring rubric", () => {
  const answer = (mistakes: string[], ratings: Record<string, number | null>) => ({
    question: "Two Sum", evidence: "I'll use a hash map", answerSummary: "s", mistakes, score: 85, ratings, feedback: "f", idealAnswer: "i",
  });

  it("scores coding categories instead of the standard five", () => {
    expect(categoriesFor("dsa")).toEqual(["Problem-Solving Approach", "Correctness", "Complexity Analysis", "Code Quality", "Communication"]);
    expect(categoriesFor("system_design")).toContain("Data Modeling");
  });

  it("has the round's rating keys in its output schema", () => {
    const shape = scoringSchema(false, "dsa").shape.questionFeedback.element.shape.ratings.shape;
    expect(Object.keys(shape)).toEqual(["approach", "correctness", "complexity", "codeQuality", "communication"]);
  });

  it("caps only complexity for a complexity mistake - working code keeps its correctness", () => {
    const [q] = applyScoringRules(
      { categoryScores: [], questionFeedback: [answer(["Claimed O(n) for a nested loop"], { approach: 80, correctness: 90, complexity: 85, codeQuality: 80, communication: 85 })] },
      "dsa"
    ).questionFeedback;
    expect(q.score).toBe(85);
    expect(q.ratings).toMatchObject({ correctness: 90, complexity: MISTAKE_CAP, approach: 80, communication: 85 });
  });

  it("leaves Code Quality out when no code was written", () => {
    const categories = categoryScoresFromAnswers(
      { categoryScores: [], questionFeedback: [answer([], { approach: 70, correctness: 60, complexity: 65, codeQuality: null, communication: 75 })] },
      "dsa"
    );
    expect(categories.map((c) => c.name)).not.toContain("Code Quality");
    expect(categories.find((c) => c.name === "Correctness")?.score).toBe(60);
  });

  it("puts the submitted code in the scoring prompt, or says the editor was empty", () => {
    const base = { turns: [{ role: "user", content: "hash map" }], questions: ["Two Sum"], level: "mid", format: "dsa" as const, language: "python" };
    expect(buildScoringPrompt({ ...base, code: "def two_sum(): pass" })).toContain("def two_sum(): pass");
    expect(buildScoringPrompt({ ...base, code: "" })).toContain("left the editor empty");
    expect(buildScoringPrompt({ ...base, code: "x" })).toContain("Correctness");
  });
});
