'use server';

import { desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { interviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import { getReportForInterview } from "@/lib/actions/reports";
import { resilientGenerateObject } from "@/lib/ai/generate";
import { buildFocusedQuestionsPrompt } from "@/lib/ai/prompts";
import { checkRateLimit } from "@/lib/rateLimit";

const FOCUSED_AMOUNT = 5;

export async function getMyInterviews(): Promise<Interview[] | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    return db.select()
        .from(interviews)
        .where(eq(interviews.userId, user.id))
        .orderBy(desc(interviews.createdAt));
}

export async function getCommunityInterviews(limit = 20): Promise<Interview[] | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    return db.select()
        .from(interviews)
        .where(ne(interviews.userId, user.id))
        .orderBy(desc(interviews.createdAt))
        .limit(limit);
}

export async function deleteInterview(id: string): Promise<{ success: boolean }> {
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

    const limited = await checkRateLimit(user.id, "generate", 10);
    if (!limited.ok) return { success: false, message: "Too many interviews generated. Try again in an hour." };

    try {
        const { object } = await resilientGenerateObject({
            schema: z.object({ questions: z.array(z.string().min(1)).min(1) }),
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

export async function getInterview(id: string): Promise<Interview | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const [interview] = await db.select()
        .from(interviews)
        .where(eq(interviews.id, id))
        .limit(1);
    if (!interview) return null;

    // Community interviews are takeable by anyone, but the owner's JD and
    // resume-derived data are personal - never expose them to other users
    // (they would otherwise surface in the fit panel and in the interviewer
    // system prompt, which the voice token route echoes to the browser).
    if (interview.userId !== user.id) {
        return { ...interview, jdText: null, resumeSnapshot: null, fitSnapshot: null };
    }

    return interview;
}
