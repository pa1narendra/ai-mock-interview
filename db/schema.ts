import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Auth tables (managed by Better Auth - names/columns follow its conventions)
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // --- Referral-earned Pro tier (app-managed; Better Auth ignores these) ---
  isPro: boolean("is_pro").notNull().default(false),        // admin override
  proRevoked: boolean("pro_revoked").notNull().default(false), // admin turned Pro off, even if earned
  referralCode: text("referral_code").unique(),             // this user's invite code
  referredBy: text("referred_by"),                          // referrer's user id
  referralCount: integer("referral_count").notNull().default(0), // converted referrals
  referralCredited: boolean("referral_credited").notNull().default(false), // did this user credit their referrer yet
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
}, (table) => [
  // Better Auth lists and revokes sessions by user.
  index("session_user_id_idx").on(table.userId),
]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  // Sign-in looks up the user's credential account.
  index("account_user_id_idx").on(table.userId),
]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

export const resumes = pgTable("resumes", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  // Model-extracted markdown rendition - the PDF itself is never stored.
  // The PDF is read exactly once (at upload); all reuse reads this markdown.
  markdown: text("markdown").notNull(),
  profile: jsonb("profile").$type<ResumeProfile>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});

export const interviews = pgTable("interviews", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: text("role").notNull(),
  level: text("level").notNull(),
  type: text("type").notNull(),
  // The kind of round (lib/schemas.ts ROUND_FORMATS). Difficulty and
  // language only apply to DSA rounds.
  format: text("format").$type<"standard" | "dsa" | "system_design">().notNull().default("standard"),
  difficulty: text("difficulty").$type<"easy" | "medium" | "hard">(),
  language: text("language"),
  techstack: jsonb("techstack").$type<string[]>().notNull(),
  questions: jsonb("questions").$type<string[]>().notNull(),
  // DSA rounds: each problem's function signature and checked test cases
  // (lib/problems.ts), aligned with questions; null for a problem that is
  // reviewed only. Null for other rounds and for DSA rounds before 0.9.0.
  problemSpecs: jsonb("problem_specs").$type<Array<import("@/lib/problems").ProblemSpec | null>>(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  jdText: text("jd_text"),
  resumeSnapshot: jsonb("resume_snapshot").$type<ResumeProfile>(),
  fitSnapshot: jsonb("fit_snapshot").$type<FitSnapshot>(),
  // Prebuilt Gemini Live voice for the interviewer (falls back to LIVE_VOICE).
  voice: text("voice"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("interviews_user_id_idx").on(table.userId),
  index("interviews_created_idx").on(table.createdAt),
]);

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  totalScore: integer("total_score").notNull(),
  categoryScores: jsonb("category_scores")
    .$type<Array<{ name: string; score: number; comment: string }>>()
    .notNull(),
  strengths: jsonb("strengths").$type<string[]>().notNull(),
  areasForImprovement: jsonb("areas_for_improvement").$type<string[]>().notNull(),
  finalAssessment: text("final_assessment").notNull(),
  jdMatch: jsonb("jd_match").$type<JdMatch>(),
  questionFeedback: jsonb("question_feedback").$type<QuestionFeedback[]>(),
  attempt: integer("attempt").notNull().default(1),
  // Random token for the public read-only share link; null = not shared.
  shareId: uuid("share_id").unique(),
  // The model that scored this report (a fallback model scores differently,
  // so attempts are only directly comparable when this matches).
  // Null on reports from before 0.7.2.
  scoredBy: text("scored_by"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  // Score history and the dashboard read a user's reports across interviews.
  // (Lookups by interview + user use the unique index below.)
  index("reports_user_created_idx").on(table.userId, table.createdAt),
  // One report per attempt: a double-clicked "Generate report" can't save two.
  uniqueIndex("reports_interview_user_attempt_uq").on(table.interviewId, table.userId, table.attempt),
]);

// Saved the moment an interview session ends, BEFORE report generation -
// if the AI is unavailable the answers survive and the report can be
// generated later from this row.
export const transcripts = pgTable("transcripts", {
  id: uuid("id").primaryKey().defaultRandom(),
  interviewId: uuid("interview_id")
    .notNull()
    .references(() => interviews.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  attempt: integer("attempt").notNull(),
  turns: jsonb("turns").$type<SavedMessage[]>().notNull(),
  // The candidate's final code in a DSA round (null for other rounds).
  code: text("code"),
  status: text("status").$type<"pending" | "reported">().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  // Database-enforced attempt numbering: two concurrent session-ends can't
  // create duplicate attempts (the loser fails and the UI offers a retry).
  uniqueIndex("transcripts_interview_user_attempt_uq").on(table.interviewId, table.userId, table.attempt),
]);

export const rateLimits = pgTable("rate_limits", {
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Separate fixed-window counters per action (e.g. "generate", "report").
  action: text("action").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.userId, table.action] }),
]);
