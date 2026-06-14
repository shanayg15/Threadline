CREATE TYPE "public"."message_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "approval_status" "message_approval_status";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "approved_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messages_one_open_draft_per_conversation" ON "messages" USING btree ("conversation_id") WHERE "messages"."approval_status" = 'pending';