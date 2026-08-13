'use server';

import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { interviews, reports, transcripts, user } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import { getPermissions } from "@/lib/permissions";

// Referral reward: the first time a referred user completes an interview, credit
// the person who referred them (once). The credit flag is flipped atomically so
// two concurrent completions can't double-count.
async function creditReferrerOnce(userId: string): Promise<void> {
    try {
        const flipped = await db
            .update(user)
            .set({ referralCredited: true })
            .where(and(eq(user.id, userId), eq(user.referralCredited, false), isNotNull(user.referredBy)))
            .returning({ referredBy: user.referredBy });
        const referrerId = flipped[0]?.referredBy;
        if (referrerId) {
            await db
                .update(user)
                .set({ referralCount: sql`${user.referralCount} + 1` })
                .where(eq(user.id, referrerId));
        }
    } catch {
        // referral columns not migrated yet - skip silently.
    }
}

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
        if (attemptsUsed >= getPermissions(user).maxAttempts) return { success: false as const };

        const [row] = await db.insert(transcripts).values({
            interviewId,
            userId: user.id,
            attempt: attemptsUsed + 1,
            turns: transcript,
        }).returning({ id: transcripts.id, attempt: transcripts.attempt });

        // Completing an interview is what converts a referral.
        await creditReferrerOnce(user.id);

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
