'use server';

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema";

export async function getCurrentUser(): Promise<User | null> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;

    const { id, name, email } = session.user;

    // Effective Pro = admin override OR at least one converted referral.
    // Wrapped so the app still works before the referral migration is applied.
    let isPro = false;
    try {
        const [row] = await db
            .select({ isPro: userTable.isPro, referralCount: userTable.referralCount })
            .from(userTable)
            .where(eq(userTable.id, id))
            .limit(1);
        if (row) isPro = row.isPro || (row.referralCount ?? 0) >= 1;
    } catch {
        // referral columns not migrated yet - default to Normal.
    }

    return { id, name, email, isPro };
}

export async function isAuthenticated() {
    const user = await getCurrentUser();
    return !!user;
}

export async function signOut() {
    await auth.api.signOut({ headers: await headers() });
    redirect('/sign-in');
}
