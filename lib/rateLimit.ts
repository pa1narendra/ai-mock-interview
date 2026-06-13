import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/db/schema";

const WINDOW = "1 hour";

// Fixed-window counter as a single atomic upsert, per (user, action): if the
// stored window has expired the counter resets to 1, otherwise it increments.
// Fails open so an outage never blocks legitimate users.
export async function checkRateLimit(
  userId: string,
  action: string,
  maxRequests: number
): Promise<{ ok: boolean }> {
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ userId, action, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.userId, rateLimits.action],
        set: {
          count: sql`CASE WHEN ${rateLimits.windowStart} < now() - interval '${sql.raw(WINDOW)}' THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStart: sql`CASE WHEN ${rateLimits.windowStart} < now() - interval '${sql.raw(WINDOW)}' THEN now() ELSE ${rateLimits.windowStart} END`,
        },
      })
      .returning({ count: rateLimits.count });

    return { ok: row.count <= maxRequests };
  } catch (e) {
    console.error("rate limit check failed", e);
    return { ok: true };
  }
}
