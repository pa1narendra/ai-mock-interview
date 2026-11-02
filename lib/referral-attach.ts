import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema";

// Records who referred this user (once). Best-effort and never throws:
// attribution must never block sign-up or sign-in. Server-only so the browser
// can't attach arbitrary users - the action wrapper passes the session user.
export async function attachReferrerToUser(userId: string, code: string): Promise<void> {
  const trimmed = code.trim();
  if (!trimmed) return;
  try {
    const [self] = await db
      .select({ referredBy: userTable.referredBy })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!self || self.referredBy) return; // already attributed

    const [referrer] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.referralCode, trimmed))
      .limit(1);
    if (!referrer || referrer.id === userId) return; // invalid or self-referral

    await db.update(userTable).set({ referredBy: referrer.id }).where(eq(userTable.id, userId));
  } catch {
    /* not migrated / transient - ignore, attribution is best-effort */
  }
}
