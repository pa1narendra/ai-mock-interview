CREATE TABLE "resumes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"markdown" text NOT NULL,
	"profile" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "jd_text" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "resume_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "fit_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "reports" ADD COLUMN "jd_match" jsonb;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;