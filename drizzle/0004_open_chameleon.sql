CREATE INDEX "interviews_user_id_idx" ON "interviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interviews_finalized_created_idx" ON "interviews" USING btree ("finalized","created_at");--> statement-breakpoint
CREATE INDEX "reports_interview_user_idx" ON "reports" USING btree ("interview_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transcripts_interview_user_attempt_uq" ON "transcripts" USING btree ("interview_id","user_id","attempt");--> statement-breakpoint
CREATE INDEX "transcripts_interview_user_idx" ON "transcripts" USING btree ("interview_id","user_id");