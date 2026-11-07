'use server';

import { isUuid } from "@/lib/utils";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { interviews, reports, transcripts } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import { getPermissions } from "@/lib/permissions";
import { countUserTurns, liveUsageSchema, MIN_ANSWERS_FOR_ATTEMPT, transcriptSchema } from "@/lib/schemas";
import { verifySessionTicket } from "@/lib/session-ticket";

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
    if (!isUuid(interviewId)) return 0;
    const user = await getCurrentUser();
    if (!user) return 0;
    return countAttempts(interviewId, user.id);
}

export async function saveTranscript(params: {
    interviewId: string;
    transcript: SavedMessage[];
    // Issued by /api/voice/token for this attempt - proves the interview happened.
    ticket: string;
    usage?: unknown;
}) {
    if (!isUuid(params?.interviewId)) return { success: false as const };
    const { interviewId } = params;
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false as const };
        const parsed = transcriptSchema.safeParse(params.transcript);
        if (!parsed.success) return { success: false as const };
        const transcript = parsed.data;
        // Too short to score: don't spend an attempt on it.
        if (countUserTurns(transcript) < MIN_ANSWERS_FOR_ATTEMPT) {
            return { success: false as const, tooShort: true as const };
        }

        // Only the owner takes an interview (others personalize a copy).
        const [interview] = await db.select({ id: interviews.id, userId: interviews.userId })
            .from(interviews)
            .where(eq(interviews.id, interviewId))
            .limit(1);
        if (!interview || interview.userId !== user.id) return { success: false as const };

        const attemptsUsed = await countAttempts(interviewId, user.id);
        if (attemptsUsed >= getPermissions(user).maxAttempts) return { success: false as const };
        // One ticket per attempt: it names the attempt it was minted for, so
        // it can't be replayed once that attempt is saved.
        if (!verifySessionTicket(params.ticket, { userId: user.id, interviewId, attempt: attemptsUsed + 1 })) {
            return { success: false as const, invalidSession: true as const };
        }

        const [row] = await db.insert(transcripts).values({
            interviewId,
            userId: user.id,
            attempt: attemptsUsed + 1,
            turns: transcript,
        }).returning({ id: transcripts.id, attempt: transcripts.attempt });

        // Real Live API usage for this interview, for cost tracking. It shows
        // up in the Vercel function logs.
        const usage = liveUsageSchema.safeParse(params.usage);
        if (usage.success) {
            console.info("live_usage", JSON.stringify({ interviewId, attempt: row.attempt, answers: countUserTurns(transcript), ...usage.data }));
        }

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
    if (!isUuid(interviewId)) return [];
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
    if (!isUuid(interviewId)) return [];
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
