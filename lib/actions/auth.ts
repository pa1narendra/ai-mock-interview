'use server';

import { cache } from "react";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { user as userTable } from "@/db/schema";

// Deduped per request: this runs once even though the layout, the page, and
// every data action call getCurrentUser during a single render. Without this,
// each call hit the session store + a Pro lookup, multiplying DB round-trips
// per page and overwhelming the connection limit (which surfaced as an
// RSC-fetch-failed reload loop).
const loadCurrentUser = cache(async (): Promise<User | null> => {
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
});

export async function getCurrentUser(): Promise<User | null> {
    return loadCurrentUser();
}

export async function isAuthenticated() {
    const user = await getCurrentUser();
    return !!user;
}

export async function signOut() {
    await auth.api.signOut({ headers: await headers() });
    redirect('/sign-in');
}
