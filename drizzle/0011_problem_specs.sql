-- Additive: a nullable column, nothing existing changes. Run this before
-- deploying 0.9.0 (the app reads the column on every interview query).
ALTER TABLE "interviews" ADD COLUMN IF NOT EXISTS "problem_specs" jsonb;
