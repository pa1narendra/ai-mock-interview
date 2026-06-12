import { z } from "zod";

export const MAX_INTERVIEW_ATTEMPTS = 3;

export const interviewRequestSchema = z
  .object({
    role: z.string().trim().min(2, "Role is required").max(100),
    level: z.enum(["junior", "mid", "senior"]),
    type: z.enum(["technical", "behavioural", "mixed"]),
    techstack: z.string().trim().max(200).optional().default(""),
    amount: z.coerce
      .number({ message: "Enter a number between 1 and 20" })
      .int()
      .min(1)
      .max(20),
    jd: z.string().trim().max(15_000).optional().default(""),
    useSavedResume: z.coerce.boolean().optional().default(false),
  })
  .refine((value) => value.techstack.length > 0 || value.jd.length > 0, {
    message: "Add a tech stack or paste a job description",
    path: ["techstack"],
  });

export type InterviewRequest = z.infer<typeof interviewRequestSchema>;

// Client-side variant for react-hook-form: no coercion/defaults (the form
// supplies real types), mode-specific requirements are enforced on submit.
export const interviewFormSchema = z.object({
  role: z.string().trim().min(2, "Role is required").max(100),
  level: z.enum(["junior", "mid", "senior"]),
  type: z.enum(["technical", "behavioural", "mixed"]),
  techstack: z.string().trim().max(200),
  amount: z
    .number({ message: "Enter a number between 1 and 20" })
    .int()
    .min(1)
    .max(20),
  jd: z.string().trim().max(15_000, "Job description is too long (15,000 characters max)"),
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

export const reportSchema = z.object({
  totalScore: z.number(),
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
