import "server-only";

import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { interviews } from "@/db/schema";
import { getPermissions } from "@/lib/permissions";
import { checkRateLimit } from "@/lib/rateLimit";

export type QuotaResult = { ok: true } | { ok: false; status: 403 | 429; message: string };

// Every path that creates an interview goes through this: hourly burst +
// daily cost cap, then the tier cap on owned interviews (Normal 5 / Pro 20).
// The checks short-circuit so a blocked request doesn't also burn a slot in
// the next counter.
export async function checkGenerationQuota(user: User): Promise<QuotaResult> {
  const perms = getPermissions(user);
  if (perms.unlimitedUsage) return { ok: true };

  const hourly = await checkRateLimit(user.id, "generate", 10);
  if (!hourly.ok) {
    return { ok: false, status: 429, message: "Too many interviews generated. Try again in an hour." };
  }
  const daily = await checkRateLimit(user.id, "generate_day", 40, "1 day");
  if (!daily.ok) {
    return { ok: false, status: 429, message: "You've hit today's interview-generation limit. Please try again tomorrow." };
  }

  const [{ count: ownedInterviews }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(interviews)
    .where(eq(interviews.userId, user.id));
  if (ownedInterviews >= perms.maxInterviews) {
    return {
      ok: false,
      status: 403,
      message: perms.isPro
        ? `You've reached your limit of ${perms.maxInterviews} interviews.`
        : `You've reached the free limit of ${perms.maxInterviews} interviews. Refer a friend who completes an interview to unlock Pro (20).`,
    };
  }

  return { ok: true };
}
