'use server';

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { interviews, reports, transcripts } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import { MAX_INTERVIEW_ATTEMPTS } from "@/lib/schemas";

// Attempts are counted from transcripts (an interview you completed consumes
// an attempt even if report generation failed), with legacy reports counted
// too for rows created before transcripts existed.
async function countAttempts(interviewId: string, userId: string): Promise<number> {
    const [latestTranscript] = await db.select({ attempt: transcripts.attempt })
        .from(transcripts)
        .where(and(eq(transcripts.interviewId, interviewId), eq(transcripts.userId, userId)))
        .orderBy(desc(transcripts.attempt))
        .limit(1);
    const [latestReport] = await db.select({ attempt: reports.attempt })
        .from(reports)
        .where(and(eq(reports.interviewId, interviewId), eq(reports.userId, userId)))
        .orderBy(desc(reports.attempt))
        .limit(1);
    return Math.max(latestTranscript?.attempt ?? 0, latestReport?.attempt ?? 0);
}

export async function getAttemptsUsed(interviewId: string): Promise<number> {
    const user = await getCurrentUser();
    if (!user) return 0;
    return countAttempts(interviewId, user.id);
}

export async function saveTranscript(params: { interviewId: string; transcript: SavedMessage[] }) {
    const { interviewId, transcript } = params;
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false as const };
        if (!transcript.length) return { success: false as const };

        const [interview] = await db.select({ id: interviews.id })
            .from(interviews)
            .where(eq(interviews.id, interviewId))
            .limit(1);
        if (!interview) return { success: false as const };

        const attemptsUsed = await countAttempts(interviewId, user.id);
        if (attemptsUsed >= MAX_INTERVIEW_ATTEMPTS) return { success: false as const };

        const [row] = await db.insert(transcripts).values({
            interviewId,
            userId: user.id,
            attempt: attemptsUsed + 1,
            turns: transcript,
        }).returning({ id: transcripts.id, attempt: transcripts.attempt });

        // Back-navigation should reflect the consumed attempt without a refresh.
        revalidatePath(`/interviews/${interviewId}`);
        revalidatePath("/dashboard");

        return { success: true as const, transcriptId: row.id, attempt: row.attempt };
    } catch (e) {
        console.error('failed to save transcript', e);
        return { success: false as const };
    }
}

// The saved turns for one attempt, for read-only display on the report page.
export async function getTranscriptTurns(interviewId: string, attempt: number): Promise<SavedMessage[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const [row] = await db.select({ turns: transcripts.turns })
        .from(transcripts)
        .where(and(
            eq(transcripts.interviewId, interviewId),
            eq(transcripts.userId, user.id),
            eq(transcripts.attempt, attempt),
        ))
        .limit(1);

    return row?.turns ?? [];
}

// Completed attempts whose report generation failed - shown on the report
// page with a retry button.
export async function getPendingTranscripts(interviewId: string): Promise<Array<{ id: string; attempt: number; createdAt: string }>> {
    const user = await getCurrentUser();
    if (!user) return [];

    return db.select({ id: transcripts.id, attempt: transcripts.attempt, createdAt: transcripts.createdAt })
        .from(transcripts)
        .where(and(
            eq(transcripts.interviewId, interviewId),
            eq(transcripts.userId, user.id),
            eq(transcripts.status, "pending"),
        ))
        .orderBy(transcripts.attempt);
}
