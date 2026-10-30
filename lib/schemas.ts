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

export const interviewRequestSchema = z
  .object({
    role: z.string().trim().min(2, "Role is required").max(100),
    level: z.enum(["junior", "mid", "senior"]),
    type: z.enum(["technical", "behavioural", "mixed"]),
    techstack: z.string().trim().max(200).optional().default(""),
    amount: z.coerce
      .number({ message: questionCountMessage })
      .int()
      .min(MIN_QUESTIONS, questionCountMessage)
      .max(MAX_QUESTIONS, questionCountMessage),
    jd: z.string().trim().max(15_000).optional().default(""),
    useSavedResume: z.coerce.boolean().optional().default(false),
    voice: z.enum(VOICE_VALUES).optional(),
  })
  .refine((value) => value.techstack.length > 0 || value.jd.length > 0, {
    message: "Add a tech stack or paste a job description",
    path: ["techstack"],
  });

export type InterviewRequest = z.infer<typeof interviewRequestSchema>;

// The transcript arrives from the browser, so bound its shape and size.
export const transcriptSchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(10_000),
    })
  )
  .min(1)
  .max(500);

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
  techstack: z.string().trim().max(200),
  amount: z
    .number({ message: questionCountMessage })
    .int()
    .min(MIN_QUESTIONS, questionCountMessage)
    .max(MAX_QUESTIONS, questionCountMessage),
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

export const questionFeedbackSchema = z.array(
  z.object({
    question: z.string(),
    answerSummary: z.string(),
    score: z.number(),
    feedback: z.string(),
    idealAnswer: z.string(),
  })
);

// No totalScore: the server computes it from the categories (averageScore).
export const reportSchema = z.object({
  categoryScores: z
    .array(
      z.object({
        name: z.string(),
        score: z.number(),
        comment: z.string(),
      })
    )
    .length(5),
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
});
