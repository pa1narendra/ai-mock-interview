'use server';

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { interviews, reports, transcripts } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import { resilientGenerateObject } from "@/lib/ai/generate";
import { buildScoringPrompt, SCORING_MODEL_SETTINGS, SCORING_SYSTEM, scoringSchema, categoryScoresFromAnswers, type ScoringResult } from "@/lib/ai/scoring";
import { checkRateLimit } from "@/lib/rateLimit";
import { getPermissions } from "@/lib/permissions";
import { creditReferrerOnce } from "@/lib/referral-credit";
import {
    countUserTurns,
    MAX_QUESTIONS,
    MIN_ANSWERS_FOR_ATTEMPT,
} from "@/lib/schemas";
import { averageScore, clampScore } from "@/lib/utils";

// Generates a report from a transcript saved by saveTranscript(). The
// transcript is durable, so a failure here loses nothing - the report page
// offers a retry for any pending transcript.
export async function createReport(transcriptId: string) {
    try {
        const user = await getCurrentUser();
        if (!user) return { success: false as const };

        const [transcript] = await db.select()
            .from(transcripts)
            .where(and(eq(transcripts.id, transcriptId), eq(transcripts.userId, user.id)))
            .limit(1);
        if (!transcript) return { success: false as const };

        // Already reported (e.g. double-click on retry): return the existing one.
        if (transcript.status === "reported") {
            const [existing] = await db.select({ id: reports.id, attempt: reports.attempt })
                .from(reports)
                .where(and(
                    eq(reports.interviewId, transcript.interviewId),
                    eq(reports.userId, user.id),
                    eq(reports.attempt, transcript.attempt),
                ))
                .limit(1);
            if (existing) return { success: true as const, reportId: existing.id, attempt: existing.attempt };
        }

        // Light rate limit: closes the retry-spam vector on a failing
        // transcript (separate counter from interview generation).
        if (!getPermissions(user).unlimitedUsage) {
            const limited = await checkRateLimit(user.id, "report", 20);
            if (!limited.ok) return { success: false as const, rateLimited: true };
        }

        const [interview] = await db.select()
            .from(interviews)
            .where(eq(interviews.id, transcript.interviewId))
            .limit(1);
        if (!interview) return { success: false as const };

        // JD/resume context is personal to the interview's owner - when
        // someone else takes a community interview, score them generically.
        const withJd = Boolean(interview.jdText) && interview.userId === user.id;

        const { object } = await resilientGenerateObject({
            schema: scoringSchema(withJd),
            system: SCORING_SYSTEM,
            prompt: buildScoringPrompt({
                turns: transcript.turns,
                questions: interview.questions,
                role: interview.role,
                level: interview.level,
                jd: withJd
                    ? {
                        text: interview.jdText!,
                        resumeSummary: interview.resumeSnapshot?.summary,
                        missingSkills: interview.fitSnapshot?.missingSkills,
                    }
                    : null,
            }),
            ...SCORING_MODEL_SETTINGS,
        });

        const result = object as ScoringResult;
        const categoryScores = categoryScoresFromAnswers(result);

        // onConflictDoNothing: a concurrent call (double-click) for the same
        // attempt already saved its report - return that one instead.
        const [inserted] = await db.insert(reports).values({
            interviewId: transcript.interviewId,
            userId: user.id,
            totalScore: averageScore(categoryScores),
            categoryScores,
            strengths: result.strengths,
            areasForImprovement: result.areasForImprovement,
            finalAssessment: result.finalAssessment,
            jdMatch: withJd && result.jdMatch
                ? {
                    ...result.jdMatch,
                    coverageScore: Math.max(0, Math.min(100, Math.round(result.jdMatch.coverageScore))),
                    gapsAddressed: result.jdMatch.gapsAddressed.slice(0, 10),
                    gapsRemaining: result.jdMatch.gapsRemaining.slice(0, 10),
                }
                : null,
            questionFeedback: (result.questionFeedback ?? [])
                .slice(0, MAX_QUESTIONS)
                .map(({ ratings: _ratings, ...q }) => ({ ...q, score: clampScore(q.score) })),
            attempt: transcript.attempt,
        }).onConflictDoNothing().returning({ id: reports.id });

        const report = inserted ?? (await db.select({ id: reports.id })
            .from(reports)
            .where(and(
                eq(reports.interviewId, transcript.interviewId),
                eq(reports.userId, user.id),
                eq(reports.attempt, transcript.attempt),
            ))
            .limit(1))[0];
        if (!report) return { success: false as const };

        // Keep the transcript turns so the candidate can review them on the
        // report page; just flip the status so it's no longer "pending".
        await db.update(transcripts)
            .set({ status: "reported" })
            .where(eq(transcripts.id, transcript.id));

        // A scored interview with real answers is what converts a referral.
        if (countUserTurns(transcript.turns) >= MIN_ANSWERS_FOR_ATTEMPT) {
            await creditReferrerOnce(user.id);
        }

        // Refresh cached pages so back-navigation shows the new attempt/score.
        revalidatePath(`/interviews/${transcript.interviewId}`);
        revalidatePath(`/interviews/${transcript.interviewId}/report`);
        revalidatePath("/dashboard");

        return { success: true as const, reportId: report.id, attempt: transcript.attempt };
    } catch (e) {
        console.error('report generation failed', e);
        return { success: false as const };
    }
}

// Batched lookup for list views: one auth check + one query instead of a
// query per card. Returns the latest attempt per interview.
export async function getMyReportsByInterview(interviewIds: string[]): Promise<Record<string, InterviewReport>> {
    const user = await getCurrentUser();
    if (!user || interviewIds.length === 0) return {};

    const rows = await db.select()
        .from(reports)
        .where(and(eq(reports.userId, user.id), inArray(reports.interviewId, interviewIds)));

    const byInterview: Record<string, InterviewReport> = {};
    for (const row of rows) {
        const existing = byInterview[row.interviewId];
        if (!existing || row.attempt > existing.attempt) {
            byInterview[row.interviewId] = row;
        }
    }
    return byInterview;
}

// All of the current user's attempts for one interview, oldest first.
export async function getReportsForInterview(interviewId: string): Promise<InterviewReport[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    return db.select()
        .from(reports)
        .where(and(eq(reports.interviewId, interviewId), eq(reports.userId, user.id)))
        .orderBy(reports.attempt);
}

// Score history across ALL of the user's reports, oldest first - powers the
// dashboard trend chart.
export async function getMyScoreHistory(): Promise<ScorePoint[]> {
    const user = await getCurrentUser();
    if (!user) return [];

    const rows = await db.select({
        createdAt: reports.createdAt,
        totalScore: reports.totalScore,
        categoryScores: reports.categoryScores,
    })
        .from(reports)
        .where(eq(reports.userId, user.id))
        .orderBy(reports.createdAt);

    return rows.map((row) => ({
        createdAt: row.createdAt,
        totalScore: row.totalScore,
        categoryScores: row.categoryScores,
    }));
}

// Mints (or clears) the public share token for a report the user owns.
export async function toggleReportShare(reportId: string): Promise<{ success: boolean; shareId?: string | null }> {
    const user = await getCurrentUser();
    if (!user) return { success: false };

    const [report] = await db.select({ shareId: reports.shareId })
        .from(reports)
        .where(and(eq(reports.id, reportId), eq(reports.userId, user.id)))
        .limit(1);
    if (!report) return { success: false };

    const nextShareId = report.shareId ? null : crypto.randomUUID();
    await db.update(reports).set({ shareId: nextShareId }).where(eq(reports.id, reportId));
    return { success: true, shareId: nextShareId };
}

// Public, unauthenticated read of a shared report. Deliberately excludes the
// transcript and any JD/resume-derived data - only the scored feedback.
export async function getSharedReport(shareId: string): Promise<SharedReport | null> {
    const [row] = await db.select({
        role: interviews.role,
        totalScore: reports.totalScore,
        categoryScores: reports.categoryScores,
        strengths: reports.strengths,
        areasForImprovement: reports.areasForImprovement,
        finalAssessment: reports.finalAssessment,
        questionFeedback: reports.questionFeedback,
        createdAt: reports.createdAt,
    })
        .from(reports)
        .innerJoin(interviews, eq(reports.interviewId, interviews.id))
        .where(eq(reports.shareId, shareId))
        .limit(1);

    if (!row) return null;
    // The verbatim quotes are pieces of the transcript, which is never shared.
    return {
        ...row,
        questionFeedback: row.questionFeedback?.map(({ evidence: _evidence, ...item }) => item) ?? null,
    };
}

export async function getReportForInterview(interviewId: string): Promise<InterviewReport | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const [report] = await db.select()
        .from(reports)
        .where(and(eq(reports.interviewId, interviewId), eq(reports.userId, user.id)))
        .orderBy(desc(reports.attempt))
        .limit(1);

    return report ?? null;
}
