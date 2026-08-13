import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
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
      await sendEmail({
        to: user.email,
        subject: "Reset your Mockstar password",
        text: `Hi ${user.name},\n\nSomeone requested a password reset for your Mockstar account. If this was you, open the link below to choose a new password:\n\n${url}\n\nThis link expires in 1 hour. If you didn't request this, you can safely ignore this email.\n\n- Mockstar`,
      });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24, // 1 day
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your Mockstar email",
        text: `Hi ${user.name},\n\nConfirm your email to activate your Mockstar account:\n\n${url}\n\nIf you didn't sign up for Mockstar, you can ignore this email.\n\n- Mockstar`,
      });
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
  },
  plugins: [nextCookies()],
});
