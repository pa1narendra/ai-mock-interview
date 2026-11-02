import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reports, user } from "@/db/schema";

// Referral reward: credit the person who referred this user, once, when both
// are true - the user has verified their email, and they have a scored report
// (which needs at least 3 real answers). Called after each report and after
// email verification, so it doesn't matter which comes first. The credit flag
// is flipped atomically so concurrent calls can't double-count.
// Lives outside the 'use server' action files on purpose - an exported
// function there would be callable from the browser.
export async function creditReferrerOnce(userId: string): Promise<void> {
    try {
        const flipped = await db
            .update(user)
            .set({ referralCredited: true })
            .where(and(
                eq(user.id, userId),
                eq(user.referralCredited, false),
                isNotNull(user.referredBy),
                eq(user.emailVerified, true),
                sql`exists (select 1 from ${reports} where ${reports.userId} = ${userId})`,
            ))
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
