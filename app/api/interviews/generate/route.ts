import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { interviews, resumes } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import {
  interviewRequestSchema,
  resumeExtractionSchema,
  fitSnapshotSchema,
} from "@/lib/schemas";
import { buildGenerationPrompt } from "@/lib/ai/prompts";
import { resilientGenerateObject } from "@/lib/ai/generate";
import { checkRateLimit } from "@/lib/rateLimit";
import { type ModelMessage } from "ai";
import { z } from "zod";

const MAX_PDF_BYTES = 4 * 1024 * 1024; // Vercel rejects bodies over ~4.5MB
const MAX_MARKDOWN_CHARS = 12_000;

// Loose on purpose - see the note in lib/schemas.ts. Limits enforced in code.
const questionsSchema = z.array(z.string().min(1)).min(1);

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  // --- parse multipart (targeted mode) with JSON fallback (quick mode) ---
  let raw: Record<string, unknown>;
  let pdfBytes: Uint8Array | null = null;
  let pdfName = "";
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      raw = Object.fromEntries(
        [...form.entries()].filter(([, value]) => typeof value === "string")
      );
      const file = form.get("resume");
      if (file instanceof File && file.size > 0) {
        if (file.type !== "application/pdf") {
          return Response.json(
            { success: false, message: "Resume must be a PDF file" },
            { status: 400 }
          );
        }
        if (file.size > MAX_PDF_BYTES) {
          return Response.json(
            { success: false, message: "Resume must be under 4MB" },
            { status: 413 }
          );
        }
        pdfBytes = new Uint8Array(await file.arrayBuffer());
        pdfName = file.name.slice(0, 200);
      }
    } else {
      raw = await request.json();
    }
  } catch {
    return Response.json({ success: false, message: "Invalid request body" }, { status: 400 });
  }

  const parsed = interviewRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { success: false, message: "Invalid input", issues: z.flattenError(parsed.error).fieldErrors },
      { status: 400 }
    );
  }

  // Only valid requests consume a rate-limit slot.
  const limited = await checkRateLimit(user.id, "generate", 10);
  if (!limited.ok) {
    return Response.json(
      { success: false, message: "Too many interviews generated. Try again in an hour." },
      { status: 429 }
    );
  }

  const { role, level, techstack, type, amount, jd, useSavedResume } = parsed.data;

  // --- resolve resume context: new upload > saved resume > none ---
  let savedResume: { markdown: string; profile: ResumeProfile } | null = null;
  if (!pdfBytes && useSavedResume) {
    const [row] = await db
      .select({ markdown: resumes.markdown, profile: resumes.profile })
      .from(resumes)
      .where(eq(resumes.userId, user.id))
      .limit(1);
    savedResume = row ?? null; // missing saved resume -> proceed JD-only
  }

  const hasJd = jd.length > 0;
  const hasResume = Boolean(pdfBytes || savedResume);
  const needsFit = hasResume && hasJd;
  const needsTechstack = hasJd && techstack.length === 0;

  // One combined call: extraction (if PDF) + questions + fit + derived stack.
  const generationSchema = z.object({
    questions: questionsSchema,
    ...(pdfBytes ? { resume: resumeExtractionSchema } : {}),
    ...(needsFit ? { fitSnapshot: fitSnapshotSchema } : {}),
    ...(needsTechstack ? { derivedTechstack: z.array(z.string()) } : {}),
  });

  const prompt = buildGenerationPrompt(
    { role, level, type, techstack, amount, jd },
    {
      hasPdf: Boolean(pdfBytes),
      hasJd,
      needsFit,
      needsTechstack,
      savedResumeText: savedResume?.markdown,
    }
  );

  const messages: ModelMessage[] = [
    {
      role: "user",
      content: [
        { type: "text" as const, text: prompt },
        ...(pdfBytes
          ? [{ type: "file" as const, data: pdfBytes, mediaType: "application/pdf" as const }]
          : []),
      ],
    },
  ];

  try {
    const { object } = await resilientGenerateObject({
      schema: generationSchema,
      messages,
    });

    const result = object as {
      questions: string[];
      resume?: z.infer<typeof resumeExtractionSchema>;
      fitSnapshot?: FitSnapshot;
      derivedTechstack?: string[];
    };

    if (pdfBytes && result.resume && !result.resume.readable) {
      return Response.json(
        {
          success: false,
          message:
            "We couldn't read that PDF. If it's a scanned image, try exporting a text-based PDF from your editor.",
        },
        { status: 422 }
      );
    }

    // Enforce the limits the schema no longer carries.
    let extractedProfile: ResumeProfile | null = null;
    if (pdfBytes && result.resume) {
      extractedProfile = {
        summary: result.resume.profile.summary,
        skills: result.resume.profile.skills.slice(0, 30),
        yearsOfExperience: result.resume.profile.yearsOfExperience,
        highlights: result.resume.profile.highlights.slice(0, 8),
        claimsToProbe: result.resume.profile.claimsToProbe.slice(0, 8),
      };
      const resumeRow = {
        fileName: pdfName,
        markdown: result.resume.markdown.slice(0, MAX_MARKDOWN_CHARS),
        profile: extractedProfile,
        updatedAt: new Date().toISOString(),
      };
      await db
        .insert(resumes)
        .values({ userId: user.id, ...resumeRow })
        .onConflictDoUpdate({ target: resumes.userId, set: resumeRow });
    }

    const fitSnapshot: FitSnapshot | null = result.fitSnapshot
      ? {
          matchScore: clamp(result.fitSnapshot.matchScore),
          verdict: result.fitSnapshot.verdict,
          matchedSkills: result.fitSnapshot.matchedSkills.slice(0, 15),
          missingSkills: result.fitSnapshot.missingSkills.slice(0, 10),
          talkingPoints: result.fitSnapshot.talkingPoints.slice(0, 6),
        }
      : null;

    const resumeSnapshot = extractedProfile ?? savedResume?.profile ?? null;
    const derivedStack = (result.derivedTechstack ?? []).slice(0, 12);
    const finalTechstack = techstack
      ? techstack.split(",").map((t) => t.trim()).filter(Boolean)
      : derivedStack.length > 0
        ? derivedStack
        : ["General"];

    const [interview] = await db
      .insert(interviews)
      .values({
        role,
        type,
        level,
        techstack: finalTechstack,
        questions: result.questions.slice(0, amount),
        userId: user.id,
        jdText: hasJd ? jd : null,
        resumeSnapshot,
        fitSnapshot,
      })
      .returning({ id: interviews.id });

    return Response.json({ success: true, interviewId: interview.id }, { status: 200 });
  } catch (error) {
    console.error("interview generation failed", error);
    return Response.json(
      { success: false, message: "Failed to generate interview. Please try again." },
      { status: 500 }
    );
  }
}
