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
});

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
});

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
  techstack: jsonb("techstack").$type<string[]>().notNull(),
  questions: jsonb("questions").$type<string[]>().notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  jdText: text("jd_text"),
  resumeSnapshot: jsonb("resume_snapshot").$type<ResumeProfile>(),
  fitSnapshot: jsonb("fit_snapshot").$type<FitSnapshot>(),
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
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  index("reports_interview_user_idx").on(table.interviewId, table.userId),
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
  status: text("status").$type<"pending" | "reported">().notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  // Database-enforced attempt numbering: two concurrent session-ends can't
  // create duplicate attempts (the loser fails and the UI offers a retry).
  uniqueIndex("transcripts_interview_user_attempt_uq").on(table.interviewId, table.userId, table.attempt),
  index("transcripts_interview_user_idx").on(table.interviewId, table.userId),
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
