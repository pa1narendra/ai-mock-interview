'use server';

import { and, desc, eq, ne } from "drizzle-orm";
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
        .where(and(eq(interviews.finalized, true), ne(interviews.userId, user.id)))
        .orderBy(desc(interviews.createdAt))
        .limit(limit);
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
