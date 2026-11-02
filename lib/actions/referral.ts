'use server';

import { randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/actions/auth";
import { effectivePro, isOwner } from "@/lib/permissions";
import { attachReferrerToUser } from "@/lib/referral-attach";

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
        proRevoked: userTable.proRevoked,
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
      isPro: effectivePro(row),
      hasReferrer: !!row.referredBy,
    };
  } catch {
    return null; // columns not migrated yet
  }
}

// Records who referred the signed-in user (once) - used after Google sign-in
// and as a fallback when arriving from a verification link. Email sign-ups
// are attributed server-side as the account is created (lib/auth.ts).
export async function attachReferrer(code: string): Promise<void> {
  if (!code) return;
  try {
    const user = await getCurrentUser();
    if (user) await attachReferrerToUser(user.id, code);
  } catch {
    /* best-effort */
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
    const rows = await db
      .select({
        id: userTable.id,
        name: userTable.name,
        email: userTable.email,
        isPro: userTable.isPro,
        proRevoked: userTable.proRevoked,
        referralCount: userTable.referralCount,
        createdAt: userTable.createdAt,
      })
      .from(userTable)
      .orderBy(desc(userTable.createdAt));
    // isPro here is the effective state, which is what the toggle shows.
    return rows.map(({ proRevoked, ...row }) => ({ ...row, isPro: effectivePro({ ...row, proRevoked }) }));
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
    // Off is an explicit revoke, so it also overrides referral-earned Pro.
    await db.update(userTable).set({ isPro: value, proRevoked: !value }).where(eq(userTable.id, userId));
    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { success: false };
  }
}
