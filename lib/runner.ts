// Runs the candidate's code against a problem's tests, in the browser.
// JavaScript runs in a fresh Web Worker per run; Python runs on Pyodide in a
// Worker that is loaded on the first run and kept warm. Either way the code
// is off the main thread, has no access to the page, and is killed when it
// runs past the time limit (an infinite loop never freezes the interview).
// It is the candidate's own code in their own browser - this is isolation
// for robustness, not a security boundary.

import { jsName, outputsMatch, type ProblemSpec, type TestCase, type TestRunSummary } from "@/lib/problems";

export interface TestResult {
  test: TestCase;
  passed: boolean;
  actual?: unknown;
  error?: string;
  output?: string; // what the code printed
}

export interface RunOutcome {
  results: TestResult[];
  // Set when nothing could run: a syntax error, a timeout, Python failing to load.
  problem?: string;
}

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.28.3/full/pyodide.js";
const TIME_LIMIT_MS = 4_000;
const PYTHON_LOAD_LIMIT_MS = 60_000;

const JS_WORKER = `
self.onmessage = (event) => {
  const { id, code, fn, tests } = event.data;
  const reply = (data) => self.postMessage({ id, ...data });
  const results = [];
  let solution;
  try {
    solution = new Function(code + "\\n;return typeof " + fn + " === 'function' ? " + fn + " : undefined;")();
  } catch (error) {
    reply({ problem: String(error && error.message || error) });
    return;
  }
  if (typeof solution !== "function") {
    reply({ problem: "Define a function named " + fn + "." });
    return;
  }
  for (const args of tests) {
    const lines = [];
    const log = (...parts) => lines.push(parts.map((p) => typeof p === "string" ? p : JSON.stringify(p)).join(" "));
    console.log = log; console.info = log; console.warn = log; console.error = log;
    try {
      const value = solution(...JSON.parse(args));
      results.push({ ok: true, actual: JSON.stringify(value === undefined ? null : value), output: lines.join("\\n") });
    } catch (error) {
      results.push({ ok: false, error: String(error && error.message || error), output: lines.join("\\n") });
    }
  }
  reply({ results });
};`;

const PY_WORKER = `
importScripts("${PYODIDE_URL}");
const ready = loadPyodide().then(async (pyodide) => {
  await pyodide.runPythonAsync("import json, sys, io");
  return pyodide;
});
self.onmessage = async (event) => {
  const { id, code, fn, tests } = event.data;
  const reply = (data) => self.postMessage({ id, ...data });
  let pyodide;
  try { pyodide = await ready; } catch (error) { reply({ problem: "Python could not load: " + error }); return; }
  if (event.data.warmOnly) { reply({ results: [] }); return; }
  pyodide.globals.set("__code", code);
  pyodide.globals.set("__fn", fn);
  pyodide.globals.set("__tests", JSON.stringify(tests.map((t) => JSON.parse(t))));
  try {
    const out = await pyodide.runPythonAsync(\`
__ns = {}
__results = []
__problem = None
try:
    exec(__code, __ns)
except Exception as e:
    __problem = type(e).__name__ + ": " + str(e)
__f = __ns.get(__fn)
if __problem is None and not callable(__f):
    __problem = "Define a function named " + __fn + "."
if __problem is None:
    for __args in json.loads(__tests):
        __buf = io.StringIO()
        __old = sys.stdout
        sys.stdout = __buf
        try:
            __value = __f(*__args)
            __results.append({"ok": True, "actual": json.dumps(__value, default=list), "output": __buf.getvalue()})
        except Exception as e:
            __results.append({"ok": False, "error": type(e).__name__ + ": " + str(e), "output": __buf.getvalue()})
        finally:
            sys.stdout = __old
json.dumps({"problem": __problem, "results": __results})
\`);
    reply(JSON.parse(out));
  } catch (error) {
    reply({ problem: String(error) });
  }
};`;

type WorkerReply = { id?: number; problem?: string | null; results?: Array<{ ok: boolean; actual?: string; error?: string; output?: string }> };

const workerFrom = (source: string) => new Worker(URL.createObjectURL(new Blob([source], { type: "text/javascript" })));

// Python's worker is expensive to start (it downloads Pyodide), so it is
// reused; it is replaced only after a timeout killed it.
let pythonWorker: Worker | null = null;
// Until Python has finished loading, a run also waits for the download.
let pythonReady = false;
const getPythonWorker = () => (pythonWorker ??= workerFrom(PY_WORKER));

let nextId = 1;
// Sends one request and waits for the reply with its id - a warm-up and a
// run can be in flight on the same Python worker at once.
function ask(worker: Worker, message: Record<string, unknown>, limitMs: number): Promise<WorkerReply | "timeout"> {
  const id = nextId++;
  return new Promise((resolve) => {
    const done = (value: WorkerReply | "timeout") => {
      clearTimeout(timer);
      worker.removeEventListener("message", onMessage);
      worker.removeEventListener("error", onError);
      resolve(value);
    };
    const onMessage = (event: MessageEvent<WorkerReply>) => {
      if (event.data?.id === id) done(event.data);
    };
    const onError = (event: ErrorEvent) => {
      event.preventDefault();
      done({ problem: event.message || "The code could not run." });
    };
    const timer = setTimeout(() => done("timeout"), limitMs);
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.postMessage({ ...message, id });
  });
}

// Starts downloading Python in the background (call when a Python round opens).
export function warmPython(): void {
  if (pythonReady) return;
  void ask(getPythonWorker(), { warmOnly: true, code: "", fn: "", tests: [] }, PYTHON_LOAD_LIMIT_MS).then((reply) => {
    if (reply !== "timeout" && !reply.problem) pythonReady = true;
  });
}

export const isPythonReady = () => pythonReady;

export async function runTests(language: string, code: string, spec: ProblemSpec, tests: TestCase[]): Promise<RunOutcome> {
  const message = {
    code,
    fn: language === "python" ? spec.functionName : jsName(spec.functionName),
    tests: tests.map((t) => JSON.stringify(t.args)),
  };

  let reply: WorkerReply | "timeout";
  if (language === "javascript") {
    const worker = workerFrom(JS_WORKER);
    reply = await ask(worker, message, TIME_LIMIT_MS);
    worker.terminate();
  } else if (language === "python") {
    // A run before Python finished loading also waits for the download.
    reply = await ask(getPythonWorker(), message, pythonReady ? TIME_LIMIT_MS : PYTHON_LOAD_LIMIT_MS);
    if (reply === "timeout") {
      pythonWorker?.terminate();
      pythonWorker = null;
      pythonReady = false;
    } else if (!reply.problem?.startsWith("Python could not load")) {
      pythonReady = true;
    }
  } else {
    return { results: [], problem: "Running code isn't available for this language yet." };
  }

  if (reply === "timeout") {
    return { results: [], problem: `Time limit exceeded (${TIME_LIMIT_MS / 1000}s) - check for an infinite loop or a very slow approach.` };
  }
  if (reply.problem) return { results: [], problem: reply.problem };

  const results = (reply.results ?? []).map((r, i): TestResult => {
    const test = tests[i];
    if (!r.ok) return { test, passed: false, error: r.error, output: r.output || undefined };
    let actual: unknown = null;
    try {
      actual = JSON.parse(r.actual ?? "null");
    } catch {
      actual = r.actual;
    }
    return { test, passed: outputsMatch(test.expected, actual, spec.compare), actual, output: r.output || undefined };
  });
  return { results };
}

export function summarize(outcome: RunOutcome, kind: TestRunSummary["kind"], total: number): TestRunSummary {
  const failures = outcome.problem
    ? [{ args: [], expected: null, error: outcome.problem }]
    : outcome.results
        .filter((r) => !r.passed)
        .slice(0, 3)
        .map((r) => ({ args: r.test.args, expected: r.test.expected, actual: r.actual, error: r.error }));
  return { kind, passed: outcome.results.filter((r) => r.passed).length, total, failures, ranAt: Date.now() };
}
