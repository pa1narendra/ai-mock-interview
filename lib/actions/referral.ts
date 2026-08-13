'use server';

import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import { isOwner } from "@/lib/permissions";

export interface ReferralInfo {
  code: string;
  referralCount: number;
  isPro: boolean;
  hasReferrer: boolean;
}

function newCode(): string {
  return randomBytes(4).toString("hex"); // 8 hex chars
}

// Returns the current user's referral info, lazily generating their invite code
// on first read. Returns null if the referral columns aren't migrated yet.
export async function getOrCreateReferral(): Promise<ReferralInfo | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  try {
    const [row] = await db
      .select({
        referralCode: userTable.referralCode,
        referralCount: userTable.referralCount,
        isPro: userTable.isPro,
        referredBy: userTable.referredBy,
      })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1);
    if (!row) return null;

    let code = row.referralCode;
    if (!code) {
      // Generate a unique code, retrying on the rare collision.
      for (let i = 0; i < 5 && !code; i++) {
        const candidate = newCode();
        try {
          await db.update(userTable).set({ referralCode: candidate }).where(eq(userTable.id, user.id));
          code = candidate;
        } catch {
          /* unique collision - retry */
        }
      }
    }
    if (!code) return null;

    return {
      code,
      referralCount: row.referralCount ?? 0,
      isPro: row.isPro || (row.referralCount ?? 0) >= 1,
      hasReferrer: !!row.referredBy,
    };
  } catch {
    return null; // columns not migrated yet
  }
}

// Called right after signup: records who referred this user (once). The
// referrer is only *credited* later, when this user completes their first
// interview (see lib/actions/transcripts.ts).
export async function attachReferrer(code: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user || !code) return;

  try {
    const [self] = await db
      .select({ referredBy: userTable.referredBy })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .limit(1);
    if (!self || self.referredBy) return; // already attributed

    const [referrer] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.referralCode, code))
      .limit(1);
    if (!referrer || referrer.id === user.id) return; // invalid or self-referral

    await db.update(userTable).set({ referredBy: referrer.id }).where(eq(userTable.id, user.id));
  } catch {
    /* columns not migrated yet - ignore */
  }
}

// ------------------------- Owner-only admin -------------------------

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  isPro: boolean;
  referralCount: number;
  createdAt: Date;
}

export async function listUsersForAdmin(): Promise<AdminUserRow[]> {
  const user = await getCurrentUser();
  if (!isOwner(user?.email)) return [];

  try {
    return await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        isPro: userTable.isPro,
        referralCount: userTable.referralCount,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .orderBy(desc(userTable.createdAt));
  } catch {
    return [];
  }
}

export async function setUserPro(
  userId: string,
  value: boolean
): Promise<{ success: boolean }> {
  const owner = await getCurrentUser();
  if (!isOwner(owner?.email)) return { success: false };

  try {
    await db.update(userTable).set({ isPro: value }).where(eq(userTable.id, userId));
    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { success: false };
  }
}
