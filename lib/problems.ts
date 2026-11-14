// Coding problems as structured data, so they can be run: a function
// signature and test cases next to the statement. Shared by the server
// (generation, validation, scoring) and the browser (editor, runner) - keep
// it free of server-only imports.
//
// The examples shown to the candidate are rendered from the same test data
// the code is checked against, after the server proved a reference solution
// passes them - so a displayed example can never be wrong.

export interface TestCase {
  // Positional arguments of the function, as JSON values.
  args: unknown[];
  expected: unknown;
  explanation?: string;
}

export interface ProblemSpec {
  title: string;
  description: string;
  constraints: string;
  // snake_case; the JavaScript name is the camelCase form (two_sum -> twoSum).
  functionName: string;
  params: string[];
  // "unordered": a returned array is accepted in any order.
  compare: "exact" | "unordered";
  examples: TestCase[]; // shown on screen, checked by Run
  hidden: TestCase[]; // only checked by Submit
}

// Languages the browser can run. Java and C++ are reviewed, not run.
export const RUNNABLE_LANGUAGES = ["python", "javascript"] as const;
export const isRunnable = (language?: string | null) => (RUNNABLE_LANGUAGES as readonly string[]).includes(language ?? "");

export const jsName = (snake: string) => snake.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const VALID_IDENTIFIER = /^[a-z][a-z0-9_]{0,40}$/;
export function isValidSpecShape(spec: ProblemSpec): boolean {
  return (
    VALID_IDENTIFIER.test(spec.functionName) &&
    spec.params.length > 0 &&
    spec.params.length <= 6 &&
    spec.params.every((p) => VALID_IDENTIFIER.test(p)) &&
    spec.examples.every((t) => Array.isArray(t.args) && t.args.length === spec.params.length) &&
    spec.hidden.every((t) => Array.isArray(t.args) && t.args.length === spec.params.length)
  );
}

const show = (value: unknown) => JSON.stringify(value);

// The statement as plain text: what the interviewer and the scorer read, and
// what older interviews store in their questions list.
export function renderStatement(spec: ProblemSpec): string {
  const examples = spec.examples
    .map((t, i) => {
      const input = spec.params.map((p, j) => `${p} = ${show(t.args[j])}`).join(", ");
      return `Example ${i + 1}: ${input}\nOutput: ${show(t.expected)}${t.explanation ? `\nExplanation: ${t.explanation}` : ""}`;
    })
    .join("\n\n");
  const order = spec.compare === "unordered" ? "\nThe answer may be returned in any order." : "";
  return `Title: ${spec.title}\n${spec.description}${order}\n\n${examples}\n\nConstraints: ${spec.constraints}`;
}

export function starterCode(spec: ProblemSpec | null | undefined, language?: string | null): string {
  if (!spec) {
    return (
      {
        python: "# Write your solution here\n",
        javascript: "// Write your solution here\n",
        java: "class Solution {\n    // Write your solution here\n}\n",
        cpp: "#include <bits/stdc++.h>\nusing namespace std;\n\n// Write your solution here\n",
      }[language ?? ""] ?? ""
    );
  }
  const params = spec.params.join(", ");
  if (language === "python") return `def ${spec.functionName}(${params}):\n    # Write your solution here\n    pass\n`;
  if (language === "javascript") return `function ${jsName(spec.functionName)}(${params}) {\n  // Write your solution here\n}\n`;
  if (language === "java") return `class Solution {\n    // Implement ${jsName(spec.functionName)}(${params})\n}\n`;
  if (language === "cpp") return `#include <bits/stdc++.h>\nusing namespace std;\n\n// Implement ${spec.functionName}(${params})\n`;
  return "";
}

// Deep equality on JSON values, with a small float tolerance and optional
// any-order for a top-level array.
export function outputsMatch(expected: unknown, actual: unknown, compare: ProblemSpec["compare"] = "exact"): boolean {
  if (compare === "unordered" && Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) return false;
    const key = (v: unknown) => JSON.stringify(normalize(v));
    return JSON.stringify(expected.map(key).sort()) === JSON.stringify(actual.map(key).sort());
  }
  return deepEqual(normalize(expected), normalize(actual));
}

// Python tuples arrive as arrays, -0 as 0; round floats for comparison.
function normalize(value: unknown): unknown {
  if (typeof value === "number") return Number.isInteger(value) ? value + 0 : Math.round(value * 1e6) / 1e6;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, normalize(v)]));
  }
  return value;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((v, i) => deepEqual(v, b[i]));
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ka = Object.keys(a as object).sort();
    const kb = Object.keys(b as object).sort();
    return deepEqual(ka, kb) && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
  }
  return false;
}

// ---------------------------------------------------------------------------
// What a DSA attempt saves: the code of each problem and its last test run.
// Stored as JSON in transcripts.code; older attempts stored one plain string.
// ---------------------------------------------------------------------------

export interface TestRunSummary {
  kind: "examples" | "all";
  passed: number;
  total: number;
  // The first failures, for the interviewer and the report.
  failures: Array<{ args: unknown[]; expected: unknown; actual?: unknown; error?: string }>;
  ranAt: number;
}

export interface SubmittedProblem {
  code: string;
  run?: TestRunSummary | null;
}

const MAX_PROBLEM_CODE = 8_000;

export function serializeSubmission(problems: SubmittedProblem[]): string {
  return JSON.stringify({
    v: 1,
    problems: problems.map((p) => ({
      code: p.code.slice(0, MAX_PROBLEM_CODE),
      run: p.run ? { ...p.run, failures: p.run.failures.slice(0, 3) } : null,
    })),
  });
}

// Accepts both formats. A legacy plain-text submission is one "problem".
export function parseSubmission(stored: string | null | undefined): SubmittedProblem[] {
  if (!stored?.trim()) return [];
  try {
    const parsed = JSON.parse(stored) as { v?: number; problems?: SubmittedProblem[] };
    if (parsed && parsed.v === 1 && Array.isArray(parsed.problems)) {
      return parsed.problems.map((p) => ({ code: String(p?.code ?? ""), run: p?.run ?? null }));
    }
  } catch {
    // plain text
  }
  return [{ code: stored }];
}

export function describeRun(run: TestRunSummary | null | undefined): string {
  if (!run) return "not run";
  const head = `${run.passed}/${run.total} ${run.kind === "all" ? "tests (including hidden)" : "examples"} passed`;
  const first = run.failures[0];
  if (!first) return head;
  const got = first.error ? `error: ${first.error}` : `got ${show(first.actual)}`;
  return `${head}; first failure: input ${show(first.args)}, expected ${show(first.expected)}, ${got}`.slice(0, 400);
}
