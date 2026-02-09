-- Migration: Add email tracking and view audit logging
-- Created: 2026-02-09
-- Purpose: Enable tracking of who views communications and detailed activity logging

-- Add new activity types to enum
ALTER TYPE "activity_type" ADD VALUE IF NOT EXISTS 'call_viewed';
ALTER TYPE "activity_type" ADD VALUE IF NOT EXISTS 'email_viewed';
ALTER TYPE "activity_type" ADD VALUE IF NOT EXISTS 'task_updated';
ALTER TYPE "activity_type" ADD VALUE IF NOT EXISTS 'recording_played';

-- Add email_id column to activity_logs
ALTER TABLE "activity_logs"
ADD COLUMN IF NOT EXISTS "email_id" uuid REFERENCES "email_messages"("id") ON DELETE SET NULL;

-- Add index for email activity lookups
CREATE INDEX IF NOT EXISTS "idx_activity_logs_email_id" ON "activity_logs" ("email_id");

-- Add comment for documentation
COMMENT ON COLUMN "activity_logs"."email_id" IS 'Reference to email message for email-related activities';
