import { describe, expect, it } from "vitest";
import {
  describeRun,
  isValidSpecShape,
  jsName,
  outputsMatch,
  parseSubmission,
  renderStatement,
  serializeSubmission,
  starterCode,
  type ProblemSpec,
} from "@/lib/problems";
import { caretPowers, validateProblem } from "@/lib/ai/dsa-problems";

describe("constraint text", () => {
  it("keeps powers readable as plain text", () => {
    expect(caretPowers("2 <= n <= 10⁴, -10⁹ <= x")).toBe("2 <= n <= 10^4, -10^9 <= x");
    expect(caretPowers("n <= 10<sup>5</sup>")).toBe("n <= 10^5");
    expect(caretPowers("n <= 10^5")).toBe("n <= 10^5");
  });
});
import { applyScoringRules, buildScoringPrompt } from "@/lib/ai/scoring";

const spec: ProblemSpec = {
  title: "Two Sum",
  description: "Return the indices of the two numbers that add up to target.",
  constraints: "2 <= nums.length <= 10^4",
  functionName: "two_sum",
  params: ["nums", "target"],
  compare: "exact",
  examples: [{ args: [[2, 7, 11, 15], 9], expected: [0, 1], explanation: "2 + 7 = 9" }],
  hidden: [{ args: [[3, 3], 6], expected: [0, 1] }],
};

describe("problem specs", () => {
  it("names the function per language and writes a starter signature", () => {
    expect(jsName("length_of_longest_substring")).toBe("lengthOfLongestSubstring");
    expect(starterCode(spec, "python")).toContain("def two_sum(nums, target):");
    expect(starterCode(spec, "javascript")).toContain("function twoSum(nums, target) {");
    expect(starterCode(null, "java")).toContain("class Solution");
  });

  it("renders the shown examples from the same data the tests use", () => {
    const text = renderStatement(spec);
    expect(text).toContain("Title: Two Sum");
    expect(text).toContain("nums = [2,7,11,15], target = 9");
    expect(text).toContain("Output: [0,1]");
    expect(text).not.toContain("[3,3]"); // hidden tests stay hidden
  });

  it("compares outputs exactly, in any order when allowed, and with float tolerance", () => {
    expect(outputsMatch([0, 1], [0, 1])).toBe(true);
    expect(outputsMatch([0, 1], [1, 0])).toBe(false);
    expect(outputsMatch([[1, 2], [3]], [[3], [1, 2]], "unordered")).toBe(true);
    expect(outputsMatch(0.3, 0.1 + 0.2)).toBe(true);
    expect(outputsMatch({ a: [1] }, { a: [1] })).toBe(true);
    expect(outputsMatch(1, "1")).toBe(false);
  });

  it("rejects specs a runner can't call safely", () => {
    expect(isValidSpecShape(spec)).toBe(true);
    expect(isValidSpecShape({ ...spec, functionName: "two sum; alert(1)" })).toBe(false);
    expect(isValidSpecShape({ ...spec, examples: [{ args: [[1]], expected: 0 }] })).toBe(false); // wrong arity
  });

  it("round-trips a submission and still reads older single-editor attempts", () => {
    const run = { kind: "all" as const, passed: 5, total: 7, failures: [{ args: [[]], expected: 0, actual: null }], ranAt: 1 };
    const stored = serializeSubmission([{ code: "def two_sum(): pass", run }, { code: "" }]);
    expect(parseSubmission(stored)).toEqual([{ code: "def two_sum(): pass", run }, { code: "", run: null }]);
    expect(parseSubmission("print('legacy')")).toEqual([{ code: "print('legacy')" }]);
    expect(parseSubmission(null)).toEqual([]);
    expect(describeRun(run)).toContain("5/7 tests (including hidden) passed");
  });
});

describe("generated problem check (QuickJS sandbox)", () => {
  const raw = {
    title: "Two Sum",
    description: "d",
    constraints: "c",
    functionName: "two_sum",
    params: ["nums", "target"],
    compare: "exact" as const,
    examples: [{ argsJson: "[[2,7,11,15],9]", expectedJson: "[0,1]", explanation: "e" }],
    hidden: [
      { argsJson: "[[3,3],6]", expectedJson: "[0,1]" },
      { argsJson: "[[1,2,3],5]", expectedJson: "[1,2]" },
      { argsJson: "[[0,4,3,0],0]", expectedJson: "[0,3]" },
      { argsJson: "[[-1,-2,-3],-5]", expectedJson: "[1,2]" },
      { argsJson: "[[1,2],3]", expectedJson: "[9,9]" }, // wrong expected - must be dropped
    ],
    referenceJs: "function twoSum(nums, target) { const seen = new Map(); for (let i = 0; i < nums.length; i++) { if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i]; seen.set(nums[i], i); } return []; }",
  };

  it("keeps a problem whose reference passes, dropping hidden tests it fails", async () => {
    const checked = await validateProblem(raw);
    expect(checked?.examples).toHaveLength(1);
    expect(checked?.hidden).toHaveLength(4);
    expect(checked?.hidden.some((t) => JSON.stringify(t.expected) === "[9,9]")).toBe(false);
  });

  it("rejects a problem whose shown example is wrong", async () => {
    expect(await validateProblem({ ...raw, examples: [{ argsJson: "[[2,7,11,15],9]", expectedJson: "[1,0]", explanation: "" }] })).toBeNull();
  });

  it("survives a reference that loops forever or reaches for the server", async () => {
    const started = Date.now();
    expect(await validateProblem({ ...raw, referenceJs: "function twoSum() { while (true) {} }" })).toBeNull();
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(await validateProblem({ ...raw, referenceJs: "function twoSum() { return process.exit(1); }" })).toBeNull();
    expect(await validateProblem({ ...raw, referenceJs: "function twoSum() { return require('fs').readFileSync('.env.local', 'utf8'); }" })).toBeNull();
  });
}, 20_000);

describe("scoring with test results", () => {
  const feedback = (correctness: number, score = 90) => ({
    question: "Two Sum", evidence: "e", answerSummary: "s", mistakes: [] as string[], score, feedback: "f", idealAnswer: "i",
    ratings: { approach: 85, correctness, complexity: 80, codeQuality: 85, communication: 80 },
  });

  it("caps correctness and the score at the share of tests that passed", () => {
    const run = { kind: "all" as const, passed: 3, total: 6, failures: [], ranAt: 1 };
    const [q] = applyScoringRules({ categoryScores: [], questionFeedback: [feedback(95)] }, "dsa", [{ title: "Two Sum", run }]).questionFeedback;
    expect(q.ratings.correctness).toBe(50);
    expect(q.score).toBe(50);
  });

  it("doesn't cap when every test passed, or when only the examples were run", () => {
    const all = { kind: "all" as const, passed: 6, total: 6, failures: [], ranAt: 1 };
    const examples = { kind: "examples" as const, passed: 1, total: 2, failures: [], ranAt: 1 };
    expect(applyScoringRules({ categoryScores: [], questionFeedback: [feedback(95)] }, "dsa", [{ run: all }]).questionFeedback[0].ratings.correctness).toBe(95);
    expect(applyScoringRules({ categoryScores: [], questionFeedback: [feedback(95)] }, "dsa", [{ run: examples }]).questionFeedback[0].ratings.correctness).toBe(95);
  });

  it("gives the scorer each problem's code and test result", () => {
    const stored = serializeSubmission([
      { code: "def two_sum(nums, target): ...", run: { kind: "all", passed: 4, total: 7, failures: [{ args: [[3, 3], 6], expected: [0, 1], actual: [0, 0] }], ranAt: 1 } },
      { code: "def valid(s): ...", run: null },
    ]);
    const prompt = buildScoringPrompt({ turns: [{ role: "user", content: "x" }], questions: ["Title: Two Sum", "Title: Valid"], level: "mid", format: "dsa", code: stored, language: "python" });
    expect(prompt).toContain('<problem number="1">');
    expect(prompt).toContain("4/7 tests (including hidden) passed");
    expect(prompt).toContain("ground truth for correctness");
    expect(prompt).toContain('<problem number="2">');
  });
});
