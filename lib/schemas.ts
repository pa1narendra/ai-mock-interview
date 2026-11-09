import { z } from "zod";

// Prebuilt Gemini Live voices offered in the interview form.
export const VOICE_OPTIONS = [
  { value: "Aoede", label: "Aoede (warm)" },
  { value: "Kore", label: "Kore (neutral)" },
  { value: "Puck", label: "Puck (upbeat)" },
  { value: "Charon", label: "Charon (deep)" },
] as const;

const VOICE_VALUES = VOICE_OPTIONS.map((v) => v.value) as [string, ...string[]];

// A real interview runs 15+ questions; fewer doesn't give enough material to
// learn from. The interviewer follows up between them, so this is the plan,
// not the whole conversation.
export const MIN_QUESTIONS = 15;
export const MAX_QUESTIONS = 25;
const questionCountMessage = `Enter a number between ${MIN_QUESTIONS} and ${MAX_QUESTIONS}`;

// The kind of round. A standard interview is a conversation over many
// questions; a DSA round is a few coding problems solved in an editor; a
// system design round is one or two design prompts discussed in depth.
export const ROUND_FORMATS = ["standard", "dsa", "system_design"] as const;
export type RoundFormat = (typeof ROUND_FORMATS)[number];

export const ROUND_OPTIONS = [
  { value: "standard", label: "Standard interview" },
  { value: "dsa", label: "DSA coding round" },
  { value: "system_design", label: "System design round" },
] as const;

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const DIFFICULTY_OPTIONS = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
] as const;

export const CODE_LANGUAGES = ["python", "javascript", "java", "cpp"] as const;
export const LANGUAGE_OPTIONS = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
] as const;

// How many items each round plans, and the default. A coding problem or a
// design prompt fills 20-40 minutes on its own.
export const ROUND_LIMITS: Record<RoundFormat, { min: number; max: number; default: number; noun: string }> = {
  standard: { min: MIN_QUESTIONS, max: MAX_QUESTIONS, default: MIN_QUESTIONS, noun: "question" },
  dsa: { min: 1, max: 3, default: 2, noun: "problem" },
  system_design: { min: 1, max: 2, default: 1, noun: "design prompt" },
};

// Suggested time per item, shown as a per-problem timer. When it runs out the
// interviewer is told to wrap the problem up.
export const PROBLEM_MINUTES: Record<string, number> = { easy: 15, medium: 25, hard: 35, system_design: 35 };

export function roundCountMessage(format: RoundFormat): string {
  const { min, max, noun } = ROUND_LIMITS[format];
  return `Enter a number of ${noun}s between ${min} and ${max}`;
}

// The longest code kept for a DSA attempt (about 500 lines).
export const MAX_CODE_CHARS = 20_000;

export const interviewRequestSchema = z
  .object({
    role: z.string().trim().min(2, "Role is required").max(100),
    level: z.enum(["junior", "mid", "senior"]),
    type: z.enum(["technical", "behavioural", "mixed"]),
    format: z.enum(ROUND_FORMATS).optional().default("standard"),
    difficulty: z.enum(DIFFICULTIES).optional(),
    language: z.enum(CODE_LANGUAGES).optional(),
    techstack: z.string().trim().max(200).optional().default(""),
    amount: z.coerce.number({ message: questionCountMessage }).int(),
    jd: z.string().trim().max(15_000).optional().default(""),
    useSavedResume: z.coerce.boolean().optional().default(false),
    voice: z.enum(VOICE_VALUES).optional(),
  })
  .superRefine((value, ctx) => {
    const { min, max } = ROUND_LIMITS[value.format];
    if (value.amount < min || value.amount > max) {
      ctx.addIssue({ code: "custom", message: roundCountMessage(value.format), path: ["amount"] });
    }
    // Standard questions need something to be grounded in; rounds don't.
    if (value.format === "standard" && value.techstack.length === 0 && value.jd.length === 0) {
      ctx.addIssue({ code: "custom", message: "Add a tech stack or paste a job description", path: ["techstack"] });
    }
    if (value.format === "dsa" && (!value.difficulty || !value.language)) {
      ctx.addIssue({ code: "custom", message: "Pick a difficulty and a language", path: ["difficulty"] });
    }
  });

export type InterviewRequest = z.infer<typeof interviewRequestSchema>;

// The transcript arrives from the browser, so bound its shape and size.
// Over-long turns and transcripts are trimmed, not rejected: rejecting would
// fail every retry the same way and lose the whole interview over one
// marathon answer.
export const MAX_TURN_CHARS = 10_000;
export const MAX_TURNS = 500;
export const transcriptSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().transform((text) => text.slice(0, MAX_TURN_CHARS)),
    })
  )
  .min(1)
  .transform((turns) => turns.slice(0, MAX_TURNS));

// Live API token usage summed by the browser (lib/interview-draft.ts). It is
// client-reported, so it is only ever logged for cost tracking.
const tokenCount = z.number().int().min(0).max(1e9);
export const liveUsageSchema = z.object({
  turns: tokenCount,
  promptTokens: tokenCount,
  responseTokens: tokenCount,
  promptByModality: z.record(z.string().max(20), tokenCount),
  responseByModality: z.record(z.string().max(20), tokenCount),
});

// An interview needs real answers before it's scored: below this it doesn't
// use an attempt (an accidental Start/End shouldn't cost one or produce a
// 0/100 report), and it can't convert a referral.
export const MIN_ANSWERS_FOR_ATTEMPT = 3;

export function countUserTurns(turns: Array<{ role: string; content: string }>): number {
  return turns.filter((turn) => turn.role === "user" && turn.content.trim().length > 0).length;
}

// Client-side variant for react-hook-form: no coercion/defaults (the form
// supplies real types), mode-specific requirements are enforced on submit.
export const interviewFormSchema = z.object({
  role: z.string().trim().min(2, "Role is required").max(100),
  level: z.enum(["junior", "mid", "senior"]),
  type: z.enum(["technical", "behavioural", "mixed"]),
  format: z.enum(ROUND_FORMATS),
  difficulty: z.enum(DIFFICULTIES),
  language: z.enum(CODE_LANGUAGES),
  techstack: z.string().trim().max(200),
  // Range depends on the round - checked on submit (ROUND_LIMITS).
  amount: z.number({ message: questionCountMessage }).int(),
  jd: z.string().trim().max(15_000, "Job description is too long (15,000 characters max)"),
  voice: z.enum(VOICE_VALUES),
});

export type InterviewFormValues = z.infer<typeof interviewFormSchema>;

// ---------------------------------------------------------------------------
// Gemini structured-output schemas
// ---------------------------------------------------------------------------

// NOTE: these output schemas are deliberately loose. Gemini does not reliably
// honor max-length/max-items hints, and the AI SDK rejects the entire response
// when validation fails (AI_NoObjectGeneratedError). Limits are enforced in
// code after generation instead (truncate/slice/clamp).
export const resumeExtractionSchema = z.object({
  // False when the PDF has no extractable content (e.g. unreadable scan).
  readable: z.boolean(),
  // Markdown rendition of the resume - lightweight, structured, reusable.
  markdown: z.string(),
  profile: z.object({
    summary: z.string(),
    skills: z.array(z.string()),
    yearsOfExperience: z.string(),
    highlights: z.array(z.string()),
    claimsToProbe: z.array(z.string()),
  }),
});

export const fitSnapshotSchema = z.object({
  matchScore: z.number(),
  verdict: z.string(),
  matchedSkills: z.array(z.string()),
  missingSkills: z.array(z.string()),
  talkingPoints: z.array(z.string()),
});

export const jdMatchSchema = z.object({
  coverageScore: z.number(),
  gapsAddressed: z.array(z.string()),
  gapsRemaining: z.array(z.string()),
  comment: z.string(),
});

