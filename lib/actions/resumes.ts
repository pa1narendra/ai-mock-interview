'use server';

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resumes } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";

// Metadata only - the extracted text never ships to the client.
export async function getMyResumeMeta(): Promise<{ fileName: string; updatedAt: string } | null> {
    const user = await getCurrentUser();
    if (!user) return null;

    const [resume] = await db
        .select({ fileName: resumes.fileName, updatedAt: resumes.updatedAt })
        .from(resumes)
        .where(eq(resumes.userId, user.id))
        .limit(1);

    return resume ?? null;
}

export async function deleteMyResume(): Promise<{ success: boolean }> {
    const user = await getCurrentUser();
    if (!user) return { success: false };

    await db.delete(resumes).where(eq(resumes.userId, user.id));
    return { success: true };
}
