import "server-only";

import { z } from "zod";
import { getQuickJS, shouldInterruptAfterDeadline, type QuickJSWASMModule } from "quickjs-emscripten";
import { resilientGenerateObject } from "@/lib/ai/generate";
import { buildDsaProblemsPrompt } from "@/lib/ai/prompts";
import { isValidSpecShape, jsName, outputsMatch, renderStatement, type ProblemSpec, type TestCase } from "@/lib/problems";

// Coding problems are generated with test cases and a JavaScript reference
// solution, then checked: the reference runs against every test in a QuickJS
// sandbox (WebAssembly - no network, files or process access, killed after a
// deadline). Tests the reference fails are dropped; a problem whose examples
// fail is regenerated. The reference itself is thrown away afterwards - it
// is never stored or sent to the browser.

const MIN_HIDDEN = 4;
const MIN_EXAMPLES = 1;
const TEST_DEADLINE_MS = 1_000;

// Loose on purpose (see lib/schemas.ts): limits are enforced in code.
const generatedProblemSchema = z.object({
  title: z.string(),
  description: z.string(),
  constraints: z.string(),
  functionName: z.string(),
  params: z.array(z.string()),
  compare: z.enum(["exact", "unordered"]),
  examples: z.array(z.object({ argsJson: z.string(), expectedJson: z.string(), explanation: z.string() })),
  hidden: z.array(z.object({ argsJson: z.string(), expectedJson: z.string() })),
  referenceJs: z.string(),
});
type GeneratedProblem = z.infer<typeof generatedProblemSchema>;

// The model sometimes writes 10⁴ or 10<sup>4</sup>; plain text needs 10^4,
// or it reads as "104".
const SUPERSCRIPTS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
export function caretPowers(text: string): string {
  return text
    .replace(/<sup>\s*(-?\d+)\s*<\/sup>/gi, "^$1")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (s) => "^" + [...s].map((c) => SUPERSCRIPTS[c]).join(""));
}

let quickJs: Promise<QuickJSWASMModule> | null = null;
const loadQuickJs = () => (quickJs ??= getQuickJS());

function parseTest(raw: { argsJson: string; expectedJson: string; explanation?: string }): TestCase | null {
  try {
    const args = JSON.parse(raw.argsJson);
    if (!Array.isArray(args)) return null;
    return { args, expected: JSON.parse(raw.expectedJson), ...(raw.explanation ? { explanation: raw.explanation } : {}) };
  } catch {
    return null;
  }
}

// Runs the reference on one test in a fresh sandbox; true when it matches.
function referencePasses(engine: QuickJSWASMModule, reference: string, fn: string, test: TestCase, compare: ProblemSpec["compare"]): boolean {
  const runtime = engine.newRuntime();
  runtime.setMemoryLimit(64 * 1024 * 1024);
  runtime.setMaxStackSize(1024 * 1024);
  runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + TEST_DEADLINE_MS));
  const vm = runtime.newContext();
  try {
    const result = vm.evalCode(`${reference}\n;JSON.stringify(${fn}(...${JSON.stringify(test.args)}))`);
    if (result.error) {
      result.error.dispose();
      return false;
    }
    const output = vm.dump(result.value);
    result.value.dispose();
    return typeof output === "string" && outputsMatch(test.expected, JSON.parse(output), compare);
  } catch {
    return false;
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}

// A generated problem becomes a spec only with checked examples and enough
// checked hidden tests.
export async function validateProblem(raw: GeneratedProblem): Promise<ProblemSpec | null> {
  const spec: ProblemSpec = {
    title: raw.title.trim().slice(0, 120),
    description: caretPowers(raw.description.trim().slice(0, 2_000)),
    constraints: caretPowers(raw.constraints.trim().slice(0, 600)),
    functionName: raw.functionName.trim(),
    params: raw.params.map((p) => p.trim()),
    compare: raw.compare,
    examples: raw.examples.slice(0, 3).map(parseTest).filter((t): t is TestCase => t !== null),
    hidden: raw.hidden.slice(0, 12).map(parseTest).filter((t): t is TestCase => t !== null),
  };
  if (!isValidSpecShape(spec) || spec.examples.length < MIN_EXAMPLES) return null;

  const engine = await loadQuickJs();
  const fn = jsName(spec.functionName);
  const reference = raw.referenceJs.slice(0, 10_000);
  // Every shown example must be right; failing hidden tests are just dropped.
  if (!spec.examples.every((t) => referencePasses(engine, reference, fn, t, spec.compare))) return null;
  spec.hidden = spec.hidden.filter((t) => referencePasses(engine, reference, fn, t, spec.compare));
  return spec.hidden.length >= MIN_HIDDEN ? spec : null;
}

export interface DsaRound {
  questions: string[];
  specs: Array<ProblemSpec | null>;
}

// Generates `amount` checked problems. Problems that fail the check are
// regenerated once; if that fails too, the round keeps the problem as text
// only (reviewed, not run) rather than failing the whole request.
export async function generateDsaRound(params: {
  role: string;
  level: string;
  amount: number;
  difficulty?: string | null;
  language?: string | null;
  focus?: string[];
}): Promise<DsaRound> {
  const generate = async (amount: number, avoid: string[]) => {
    const { object } = await resilientGenerateObject({
      schema: z.object({ problems: z.array(generatedProblemSchema) }),
      prompt: buildDsaProblemsPrompt({ ...params, amount, avoid }),
      thinking: false,
    });
    return (object as { problems: GeneratedProblem[] }).problems.slice(0, amount);
  };

  const first = await generate(params.amount, []);
  const checked = await Promise.all(first.map(validateProblem));
  const specs: Array<ProblemSpec | null> = [...checked];
  const fallbackText = first.map((p) => `Title: ${p.title}\n${p.description}\n\nConstraints: ${p.constraints}`);

  const failed = specs.map((s, i) => (s ? -1 : i)).filter((i) => i >= 0);
  if (failed.length > 0) {
    try {
      const retry = await generate(failed.length, specs.filter(Boolean).map((s) => s!.title));
      const retried = await Promise.all(retry.map(validateProblem));
      failed.forEach((index, k) => {
        if (retried[k]) specs[index] = retried[k];
      });
    } catch (error) {
      console.warn("dsa problem regeneration failed", error instanceof Error ? error.message : error);
    }
  }

  const questions = specs.map((spec, i) => (spec ? renderStatement(spec) : fallbackText[i]));
  console.info("dsa round generated", JSON.stringify({ requested: params.amount, checked: specs.filter(Boolean).length }));
  return { questions, specs };
}
