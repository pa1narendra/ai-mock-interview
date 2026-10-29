import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/db/schema";

// Referral reward: the first time a referred user gets a report for a real
// interview, credit the person who referred them (once). The credit flag is
// flipped atomically so two concurrent reports can't double-count.
// Lives outside the 'use server' action files on purpose - an exported
// function there would be callable from the browser.
export async function creditReferrerOnce(userId: string): Promise<void> {
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
