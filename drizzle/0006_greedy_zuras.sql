ALTER TABLE "interviews" ADD COLUMN "voice" text;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "share_id" uuid;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_share_id_unique" UNIQUE("share_id");