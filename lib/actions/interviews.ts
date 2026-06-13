'use server';

import { desc, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { interviews } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";

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
