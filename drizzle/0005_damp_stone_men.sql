DROP INDEX "interviews_finalized_created_idx";--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "question_feedback" jsonb;--> statement-breakpoint
CREATE INDEX "interviews_created_idx" ON "interviews" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "interviews" DROP COLUMN "finalized";--> statement-breakpoint
-- rate_limits holds only ephemeral fixed-window counters; recreate it with a
-- composite (user_id, action) primary key so each action has its own counter.
DROP TABLE "rate_limits";--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"user_id" text NOT NULL,
	"action" text NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_user_id_action_pk" PRIMARY KEY("user_id","action")
);--> statement-breakpoint
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
