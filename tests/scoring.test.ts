import { describe, expect, it } from "vitest";
import { buildScoringPrompt, categoryScoresFromAnswers, SCORE_CATEGORIES, SCORING_MODEL_SETTINGS, scoringSchema } from "@/lib/ai/scoring";

const turns = [
  { role: "assistant", content: "What is a closure?" },
  { role: "user", content: "A function that remembers the variables from where it was created." },
];

describe("scoringSchema", () => {
  const category = { name: "Communication Skills", score: 70, comment: "ok" };
  const valid = {
    questionFeedback: [
      { question: "What is a closure?", evidence: "A function that remembers the variables", answerSummary: "Correct, brief.", score: 72, ratings: { communication: 70, technical: 72, problemSolving: null, fit: null, confidence: 75 }, feedback: "Add an example", idealAnswer: "I used one for..." },
    ],
    categoryScores: Array.from({ length: 5 }, () => category),
    strengths: ["clear"],
    areasForImprovement: ["depth"],
    finalAssessment: "Decent.",
  };

  it("accepts a full result with exactly five categories", () => {
    expect(scoringSchema(false).safeParse(valid).success).toBe(true);
  });

  it("rejects four or six categories", () => {
    for (const length of [4, 6]) {
      expect(scoringSchema(false).safeParse({ ...valid, categoryScores: Array.from({ length }, () => category) }).success).toBe(false);
    }
  });

  it("accepts no answered questions", () => {
    expect(scoringSchema(false).safeParse({ ...valid, questionFeedback: [] }).success).toBe(true);
  });

  it("requires the verbatim evidence quote on every answer", () => {
    const { evidence: _evidence, ...noEvidence } = valid.questionFeedback[0];
    expect(scoringSchema(false).safeParse({ ...valid, questionFeedback: [noEvidence] }).success).toBe(false);
  });

  it("requires jdMatch only for JD interviews", () => {
    expect(scoringSchema(true).safeParse(valid).success).toBe(false);
    const jdMatch = { coverageScore: 60, gapsAddressed: [], gapsRemaining: [], comment: "ok" };
    expect(scoringSchema(true).safeParse({ ...valid, jdMatch }).success).toBe(true);
  });

  it("asks for per-answer feedback before category scores", () => {
    const keys = Object.keys(scoringSchema(false).shape);
    expect(keys.indexOf("questionFeedback")).toBeLessThan(keys.indexOf("categoryScores"));
  });
});

describe("buildScoringPrompt", () => {
  const prompt = buildScoringPrompt({ turns, questions: ["What is a closure?"], role: "Frontend Developer", level: "junior" });

  it("wraps the transcript as untrusted data", () => {
    expect(prompt).toMatch(/<transcript>[\s\S]*A function that remembers[\s\S]*<\/transcript>/);
    expect(prompt).toContain("untrusted DATA");
  });

  it("anchors every band of the scale and names the candidate level", () => {
    for (const band of ["90-100", "75-89", "60-74", "40-59", "20-39", "0-19"]) expect(prompt).toContain(band);
    expect(prompt).toContain("junior Frontend Developer candidate");
  });

  it("lists all five categories in order", () => {
    const positions = SCORE_CATEGORIES.map((name) => prompt.indexOf(`"${name}"`));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("only includes the job description section when given one", () => {
    expect(prompt).not.toContain("<job_description>");
    const withJd = buildScoringPrompt({ turns, questions: [], jd: { text: "We need React and SQL." } });
    expect(withJd).toContain("<job_description>");
    expect(withJd).toContain("We need React and SQL.");
  });

  it("scores at temperature 0", () => {
    expect(SCORING_MODEL_SETTINGS.temperature).toBe(0);
  });
});

describe("categoryScoresFromAnswers", () => {
  const answer = (score: number, technical: number | null) => ({
    question: "q", evidence: "e", answerSummary: "s", feedback: "f", idealAnswer: "i", score,
    ratings: { communication: score, technical, problemSolving: null, fit: null, confidence: score },
  });
  const modelCategories = SCORE_CATEGORIES.map((name) => ({ name, score: 90, comment: `about ${name}` }));

  it("averages the per-answer ratings instead of trusting the model's number", () => {
    const result = categoryScoresFromAnswers({ questionFeedback: [answer(80, 20), answer(60, 40), answer(70, null)], categoryScores: modelCategories });
    const byName = Object.fromEntries(result.map((c) => [c.name, c.score]));
    expect(byName["Communication Skills"]).toBe(70);
    expect(byName["Technical Knowledge"]).toBe(30); // nulls skipped
  });

  it("leaves out a category no answer gave evidence for, instead of guessing", () => {
    const result = categoryScoresFromAnswers({ questionFeedback: [answer(50, null)], categoryScores: modelCategories });
    expect(result.map((c) => c.name)).toEqual(["Communication Skills", "Confidence and Clarity"]);
    expect(result[0].score).toBe(50);
  });

  it("keeps category order and the model's comments", () => {
    const result = categoryScoresFromAnswers({ questionFeedback: [answer(60, 70)], categoryScores: [...modelCategories].reverse() });
    expect(result.map((c) => c.name)).toEqual(["Communication Skills", "Technical Knowledge", "Confidence and Clarity"]);
    expect(result[1].comment).toBe("about Technical Knowledge");
  });

  it("uses the model's categories when nothing was rated at all", () => {
    const result = categoryScoresFromAnswers({ questionFeedback: [], categoryScores: modelCategories });
    expect(result).toHaveLength(5);
  });
});
