'use server';

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

const oneWeek = 60 * 60 * 24 * 7;

export async function signUp(params: SignUpParams){
    const {uid, name, email} = params;

    try{
        const useRecord = await db.collection('users').doc(uid).get();
        if(useRecord.exists){
            return {
                success : false,
                message: "Email already exists. Sign In"
            }
        }
        await db.collection('users').doc(uid).set({
            name,
            email
        })
        return {
            success : true,
            message: "User created successfully"
        }

    }catch(e){
        console.error('Error creating a user',e);

        if(e.code === 'auth/email-already-exists'){
            return {
                success : false,
                message: "Email already exists."
            }
        }
        return{
            success : false,
            message: "Error occured while creating an user."
        }
    }}

export async function signIn(params: SignInParams){
    const {email, idToken} = params;
    try{
        const userRecord = await auth.getUserByEmail(email);

        if(!userRecord){
            return {
                success : false,
                message: "User not found. Sign Up"
            }
        }

        await setSessionCookie(idToken);

        return {
            success : true,
            message: "User signed in successfully"
        }
    }catch(e){
        console.error('Error signing in',e);
        return null;
    }
}

export async function setSessionCookie(idToken: string){
    const cookieStore = await cookies();

    const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: oneWeek* 1000,
    })

    cookieStore.set('session', sessionCookie, {
        maxAge: oneWeek,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    })
}

export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;
    try {
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
        const userRecord = await db.collection('users').doc(decodedClaims.uid).get();
        
        if (!userRecord.exists) return null;
        return {
            ...userRecord.data(), id: userRecord.id
        } as User;
    } catch (error) {
        console.error('Error verifying session cookie', error);
        return null;
    }
}

export async function isAuthenticated() {
    const user = await getCurrentUser();
    return !!user;
}

