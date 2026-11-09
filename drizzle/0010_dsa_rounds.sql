-- These columns already exist in production (added by an earlier, unmerged
-- branch with exactly these definitions), so IF NOT EXISTS makes this a no-op
-- there and a normal migration everywhere else.
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "format" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "difficulty" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "language" text;--> statement-breakpoint
ALTER TABLE "transcripts" ADD COLUMN IF NOT EXISTS "code" text;
