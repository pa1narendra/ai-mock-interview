// Scoring consistency eval. Scores each fixture transcript several times with
// the app's real scoring prompt and reports how much the numbers move.
//
//   npx tsx evals/scoring/run.mts            # 5 runs per fixture
//   npx tsx evals/scoring/run.mts 3 weak     # 3 runs, fixtures matching "weak"
//
// Needs GOOGLE_GENERATIVE_AI_API_KEY (read from .env.local). Touches no
// database - fixtures are local JSON files.

import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
// EVAL_SCORER=<path to another scorer module> runs that one instead, to compare.
const { buildScoringPrompt, scoringSchema, SCORING_MODEL_SETTINGS, SCORING_SYSTEM, categoryScoresFromAnswers } = await import(
  process.env.EVAL_SCORER ?? "../../lib/ai/scoring"
);
import { averageScore, clampScore } from "@/lib/utils";

const root = path.resolve(import.meta.dirname, "../..");
try {
  for (const line of readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(GOOGLE_GENERATIVE_AI_API_KEY)\s*=\s*["']?([^"'\s]+)/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {
  /* env may come from the shell instead */
}

interface Fixture {
  label: string;
  role: string;
  level: string;
  questions: string[];
  turns: { role: string; content: string }[];
}

const runs = Number(process.argv[2] ?? 5);
const filter = process.argv[3] ?? "";
const dir = path.join(import.meta.dirname, "fixtures");
const fixtures: Fixture[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f.includes(filter))
  .map((f) => JSON.parse(readFileSync(path.join(dir, f), "utf8")));

const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
const mean = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);

async function scoreOnce(fx: Fixture) {
  const { object } = (await generateObject({
    model: google("gemini-2.5-flash"),
    schema: scoringSchema(false),
    system: SCORING_SYSTEM,
    prompt: buildScoringPrompt({ turns: fx.turns, questions: fx.questions, role: fx.role, level: fx.level }),
    maxRetries: 4,
    ...SCORING_MODEL_SETTINGS,
  })) as { object: { categoryScores: { name: string; score: number; comment: string }[]; questionFeedback: { score: number }[] } };
  const categories: { name: string; score: number }[] = categoryScoresFromAnswers
    ? categoryScoresFromAnswers(object)
    : object.categoryScores.map((c: { name: string; score: number; comment: string }) => ({ ...c, score: clampScore(c.score) }));
  return {
    total: averageScore(categories),
    categories: Object.fromEntries(categories.map((c) => [c.name, c.score])) as Record<string, number>,
    questions: object.questionFeedback.map((q: { score: number }) => clampScore(q.score)),
    raw: object,
  };
}

const GAP_MS = Number(process.env.EVAL_GAP_MS ?? 13_000);
const LABEL = process.env.EVAL_SCORER ? "baseline" : "current";
let calls = 0;
const summary: Record<string, unknown> = {};
for (const fx of fixtures) {
  // Sequential and spaced out: the free tier allows 5 requests a minute.
  const results = [];
  for (let i = 0; i < runs; i++) {
    if (calls++ > 0) await new Promise((r) => setTimeout(r, GAP_MS));
    try {
      results.push(await scoreOnce(fx));
    } catch (error) {
      console.error(`${fx.label}: run ${i + 1} failed - ${(error as Error).message.split(String.fromCharCode(10))[0]}`);
      if (/quota|RESOURCE_EXHAUSTED/i.test(String((error as Error).message))) break;
    }
  }
  if (results.length === 0) continue;
  const totals = results.map((r) => r.total);
  const catNames = Object.keys(results[0].categories);
  const catSpread = Math.max(...catNames.map((n) => spread(results.map((r) => r.categories[n] ?? 0))));
  const qCounts = results.map((r) => r.questions.length);
  console.log(
    `${fx.label.padEnd(22)} totals ${totals.join(", ").padEnd(24)} mean ${String(mean(totals)).padStart(3)}  spread ${String(spread(totals)).padStart(2)}  worst category spread ${catSpread}  questions scored ${[...new Set(qCounts)].join("/")}`
  );
  summary[fx.label] = { totals, mean: mean(totals), spread: spread(totals), catSpread, results: results.map((r) => r.raw) };
}

const out = path.join(import.meta.dirname, "results");
mkdirSync(out, { recursive: true });
const file = path.join(out, `${new Date().toISOString().replace(/[:.]/g, "-")}-${LABEL}.json`);
writeFileSync(file, JSON.stringify(summary, null, 2));
console.log(`\nFull output: ${path.relative(root, file)}`);
