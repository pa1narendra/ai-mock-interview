'use server';

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getCurrentUser(): Promise<User | null> {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) return null;

    const { id, name, email } = session.user;
    return { id, name, email };
}

export async function isAuthenticated() {
    const user = await getCurrentUser();
    return !!user;
}

export async function signOut() {
    await auth.api.signOut({ headers: await headers() });
    redirect('/sign-in');
}
