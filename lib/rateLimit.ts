import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimits } from "@/db/schema";

// Fixed literal windows only (never user input) - interpolated as raw SQL.
type Window = "1 hour" | "1 day";

// Fixed-window counter as a single atomic upsert, per (user, action): if the
// stored window has expired the counter resets to 1, otherwise it increments.
// Fails open so an outage never blocks legitimate users.
export async function checkRateLimit(
  userId: string,
  action: string,
  maxRequests: number,
  window: Window = "1 hour"
): Promise<{ ok: boolean }> {
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ userId, action, count: 1 })
      .onConflictDoUpdate({
        target: [rateLimits.userId, rateLimits.action],
        set: {
          count: sql`CASE WHEN ${rateLimits.windowStart} < now() - interval '${sql.raw(window)}' THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStart: sql`CASE WHEN ${rateLimits.windowStart} < now() - interval '${sql.raw(window)}' THEN now() ELSE ${rateLimits.windowStart} END`,
        },
      })
      .returning({ count: rateLimits.count });

    return { ok: row.count <= maxRequests };
  } catch (e) {
    console.error("rate limit check failed", e);
    return { ok: true };
  }
}
