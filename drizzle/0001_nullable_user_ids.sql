-- Migration: Make user_id and connection_id nullable for unassigned communications
-- Created: 2026-02-09
-- Purpose: Allow NULL user_id for unassigned emails/tasks from unknown senders

-- Make email_messages.user_id nullable (for unassigned emails)
ALTER TABLE "email_messages"
ALTER COLUMN "user_id" DROP NOT NULL;

-- Make email_messages.connection_id nullable (for emails from Resend forwarding, not OAuth)
ALTER TABLE "email_messages"
ALTER COLUMN "connection_id" DROP NOT NULL;

-- Make potential_tasks.user_id nullable (for unassigned task suggestions)
ALTER TABLE "potential_tasks"
ALTER COLUMN "user_id" DROP NOT NULL;

-- Add indexes for querying unassigned records
CREATE INDEX IF NOT EXISTS "idx_email_messages_unassigned" ON "email_messages" ("user_id") WHERE "user_id" IS NULL;
CREATE INDEX IF NOT EXISTS "idx_potential_tasks_unassigned" ON "potential_tasks" ("user_id") WHERE "user_id" IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN "email_messages"."user_id" IS 'NULL = unassigned email (from non-user sender, visible to all)';
COMMENT ON COLUMN "email_messages"."connection_id" IS 'NULL = from Resend forwarding (not from OAuth email connection)';
COMMENT ON COLUMN "potential_tasks"."user_id" IS 'NULL = unassigned task suggestion (visible to all users)';
