'use server';

import { isUuid } from "@/lib/utils";
import { cache } from "react";
import { desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { interviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import { getReportForInterview } from "@/lib/actions/reports";
import { resilientGenerateObject } from "@/lib/ai/generate";
import { buildFocusedQuestionsPrompt, buildRoundPrompt } from "@/lib/ai/prompts";
import { generateDsaRound } from "@/lib/ai/dsa-problems";
import { ROUND_LIMITS } from "@/lib/schemas";
import { checkGenerationQuota } from "@/lib/generation-quota";

const FOCUSED_AMOUNT = 5;

export async function getMyInterviews(): Promise<Interview[] | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    return db.select()
        .from(interviews)
        .where(eq(interviews.userId, user.id))
        .orderBy(desc(interviews.createdAt));
}

// Other users' interviews: only the public template fields, the same rule
// as getInterview. The questions, job description and resume/fit snapshots
// are personal (targeted questions name the owner's employers and projects)
// - and this is an exported server action, so whatever it returns could be
// read by any signed-in user.
export async function getCommunityInterviews(limit = 20): Promise<Interview[] | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const rows = await db.select({
        id: interviews.id,
        role: interviews.role,
        level: interviews.level,
        type: interviews.type,
        format: interviews.format,
        difficulty: interviews.difficulty,
        language: interviews.language,
        techstack: interviews.techstack,
        userId: interviews.userId,
        createdAt: interviews.createdAt,
    })
        .from(interviews)
        .where(ne(interviews.userId, user.id))
        .orderBy(desc(interviews.createdAt))
        .limit(limit);
    return rows.map((row) => ({ ...row, questions: [], problemSpecs: null, jdText: null, resumeSnapshot: null, fitSnapshot: null, voice: null }));
}

export async function deleteInterview(id: string): Promise<{ success: boolean }> {
    if (!isUuid(id)) return { success: false };
    const user = await getCurrentUser();
    if (!user) return { success: false };

    const [interview] = await db.select({ userId: interviews.userId })
        .from(interviews)
        .where(eq(interviews.id, id))
        .limit(1);
    if (!interview || interview.userId !== user.id) return { success: false };

    // FK cascade removes the interview's reports and transcripts.
    await db.delete(interviews).where(eq(interviews.id, id));
    revalidatePath("/dashboard");
    return { success: true };
}

export async function updateInterviewQuestions(
    id: string,
    questions: string[]
): Promise<{ success: boolean }> {
    if (!isUuid(id)) return { success: false };
    const user = await getCurrentUser();
    if (!user) return { success: false };

    const cleaned = questions.map((q) => q.trim()).filter(Boolean).slice(0, 20);
    if (cleaned.length === 0) return { success: false };

    const [interview] = await db.select({ userId: interviews.userId })
        .from(interviews)
        .where(eq(interviews.id, id))
        .limit(1);
    if (!interview || interview.userId !== user.id) return { success: false };

    await db.update(interviews).set({ questions: cleaned }).where(eq(interviews.id, id));
    revalidatePath(`/interviews/${id}`);
    return { success: true };
}

// Spins up a fresh interview that drills into the weaknesses a prior report
// surfaced, keeping the original role/JD/resume context.
export async function createFocusedInterview(
    sourceInterviewId: string
): Promise<{ success: boolean; interviewId?: string; message?: string }> {
    if (!isUuid(sourceInterviewId)) return { success: false, message: "Interview not found" };
    const user = await getCurrentUser();
    if (!user) return { success: false, message: "Unauthorized" };

    const source = await getInterview(sourceInterviewId);
    if (!source || source.userId !== user.id) return { success: false, message: "Interview not found" };

    const report = await getReportForInterview(sourceInterviewId);
    if (!report) return { success: false, message: "Take this interview first to get focus areas." };

    const weakAreas = [
        ...report.areasForImprovement,
        ...(report.jdMatch?.gapsRemaining ?? []),
        ...(report.questionFeedback ?? []).filter((q) => q.score < 60).map((q) => q.question),
    ].filter(Boolean);
    if (weakAreas.length === 0) {
        return { success: false, message: "No weak areas to practice - great work!" };
    }

    // Same limits as the main generate route - this creates an interview too.
    const quota = await checkGenerationQuota(user);
    if (!quota.ok) return { success: false, message: quota.message };

    // A DSA or system design round is practised as the same kind of round,
    // at the same difficulty and in the same language.
    const format = source.format ?? "standard";
    if (format !== "standard") {
        const { min, max } = ROUND_LIMITS[format];
        const amount = Math.min(max, Math.max(min, source.questions.length));
        try {
            let questions: string[];
            let problemSpecs: Interview["problemSpecs"] = null;
            if (format === "dsa") {
                const round = await generateDsaRound({
                    role: source.role,
                    level: source.level,
                    amount,
                    difficulty: source.difficulty,
                    language: source.language,
                    focus: weakAreas,
                });
                questions = round.questions.slice(0, amount);
                problemSpecs = round.specs.slice(0, amount);
            } else {
                const { object } = await resilientGenerateObject({
                    schema: z.object({ questions: z.array(z.string().min(1)).min(1) }),
                    thinking: false,
                    prompt: buildRoundPrompt({
                        format,
                        role: source.role,
                        level: source.level,
                        amount,
                        focus: weakAreas,
                    }),
                });
                questions = (object as { questions: string[] }).questions.slice(0, amount);
            }
            const [interview] = await db.insert(interviews).values({
                role: source.role,
                type: source.type,
                level: source.level,
                format,
                difficulty: source.difficulty ?? null,
                language: source.language ?? null,
                techstack: source.techstack,
                questions,
                problemSpecs,
                userId: user.id,
                voice: source.voice ?? null,
            }).returning({ id: interviews.id });
            revalidatePath("/dashboard");
            return { success: true, interviewId: interview.id };
        } catch (e) {
            console.error("focused round generation failed", e);
            return { success: false, message: "Failed to generate. Please try again." };
        }
    }

    try {
        const { object } = await resilientGenerateObject({
            schema: z.object({ questions: z.array(z.string().min(1)).min(1) }),
            thinking: false,
            prompt: buildFocusedQuestionsPrompt(
                { role: source.role, level: source.level, type: source.type, techstack: source.techstack, jd: source.jdText },
                weakAreas,
                FOCUSED_AMOUNT
            ),
        });

        const [interview] = await db.insert(interviews).values({
            role: source.role,
            type: source.type,
            level: source.level,
            techstack: source.techstack,
            questions: (object as { questions: string[] }).questions.slice(0, FOCUSED_AMOUNT),
            userId: user.id,
            jdText: source.jdText ?? null,
            resumeSnapshot: source.resumeSnapshot ?? null,
            fitSnapshot: source.fitSnapshot ?? null,
            voice: source.voice ?? null,
        }).returning({ id: interviews.id });

        revalidatePath("/dashboard");
        return { success: true, interviewId: interview.id };
    } catch (e) {
        console.error("focused interview generation failed", e);
        return { success: false, message: "Failed to generate. Please try again." };
    }
}

// Deduped per request: the page and its generateMetadata both ask for it.
const loadInterview = cache(async (id: string) => {
    const [interview] = await db.select()
        .from(interviews)
        .where(eq(interviews.id, id))
        .limit(1);
    return interview ?? null;
});

export async function getInterview(id: string): Promise<Interview | null> {
    if (!isUuid(id)) return null;
    const user = await getCurrentUser();
    if (!user) return null;

    const interview = await loadInterview(id);
    if (!interview) return null;

    // Other users only ever see the public template fields (role, level,
    // type, stack). The questions are personal too: targeted interviews
    // name the owner's employers and projects from their resume. Community
    // interviews are taken by personalizing a fresh copy, never verbatim.
    if (interview.userId !== user.id) {
        return { ...interview, questions: [], problemSpecs: null, jdText: null, resumeSnapshot: null, fitSnapshot: null };
    }

    return interview;
}
