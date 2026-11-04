import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { sendEmailInBackground } from "@/lib/email";
import { actionEmail } from "@/lib/email-templates";
import { creditReferrerOnce } from "@/lib/referral-credit";
import { attachReferrerToUser } from "@/lib/referral-attach";
import * as schema from "@/db/schema";

// Gate enforcement behind a public flag so verification can be enabled only
// once a real email sender (Resend) is configured - avoids locking anyone out.
const requireEmailVerification = process.env.NEXT_PUBLIC_REQUIRE_EMAIL_VERIFICATION === "true";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification,
    sendResetPassword: async ({ user, url }) => {
      sendEmailInBackground({
        to: user.email,
        subject: "Reset your Mockstar password",
        ...actionEmail({
          preheader: "Choose a new password for your Mockstar account.",
          heading: "Reset your password",
          greetingName: user.name,
          intro: "Someone asked to reset the password for your Mockstar account. If it was you, choose a new one below.",
          buttonLabel: "Choose a new password",
          url,
          expiry: "This link works once and expires in 1 hour.",
          reason: "Didn't ask for this? You can ignore this email - your password stays the same.",
        }),
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 1 day
    // An unverified user who tries to sign in gets a fresh link.
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      sendEmailInBackground({
        to: user.email,
        subject: "Confirm your email for Mockstar",
        ...actionEmail({
          preheader: "One click and you can start practising interviews.",
          heading: "Confirm your email",
          greetingName: user.name,
          intro: "Thanks for signing up to Mockstar. Confirm your email address to activate your account and start your first mock interview.",
          buttonLabel: "Confirm email",
          url,
          expiry: "This link expires in 24 hours.",
          reason: "You're getting this because this address was used to sign up for Mockstar. If that wasn't you, ignore this email and no account will be activated.",
        }),
      });
    },
    // Referral credit needs a verified referred account. A user can finish a
    // scored interview before verifying, so credit them when they verify too.
    afterEmailVerification: async (user) => {
      await creditReferrerOnce(user.id);
    },
  },
  // Google accounts arrive pre-verified, so OAuth users bypass the email
  // verification flow entirely. Only registered when credentials are set.
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 1 week
    // A signed copy of the session lives in a cookie for 5 minutes, so most
    // requests don't need a database round trip to know who is signed in.
    // Trade-off: sign-out elsewhere or a Pro change takes up to 5 min to apply.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  // Carried on the session (and its cookie cache) so getCurrentUser can work
  // out Pro without a separate query. input: false - never set at sign-up.
  user: {
    additionalFields: {
      isPro: { type: "boolean", input: false, defaultValue: false },
      proRevoked: { type: "boolean", input: false, defaultValue: false },
      referralCount: { type: "number", input: false, defaultValue: 0 },
    },
  },
  // The sign-up form sends the referral code with the request, so the referrer
  // is recorded as the account is created - before email verification, and
  // whichever verification email the user ends up clicking.
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          const code = (context?.body as { referralCode?: unknown } | undefined)?.referralCode;
          if (typeof code === "string") await attachReferrerToUser(user.id, code);
        },
      },
    },
  },
  plugins: [nextCookies()],
});
