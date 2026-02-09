-- Migration: Add first view tracking to communications
-- Created: 2026-02-09
-- Purpose: Track when communications are first viewed by a user

-- Add first view tracking to calls table
ALTER TABLE "calls"
ADD COLUMN IF NOT EXISTS "first_viewed_at" timestamp,
ADD COLUMN IF NOT EXISTS "first_viewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Add first view tracking to email_messages table
ALTER TABLE "email_messages"
ADD COLUMN IF NOT EXISTS "first_viewed_at" timestamp,
ADD COLUMN IF NOT EXISTS "first_viewed_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "idx_calls_first_viewed" ON "calls" ("first_viewed_at", "first_viewed_by");
CREATE INDEX IF NOT EXISTS "idx_email_messages_first_viewed" ON "email_messages" ("first_viewed_at", "first_viewed_by");

-- Add comments for documentation
COMMENT ON COLUMN "calls"."first_viewed_at" IS 'Timestamp when this call was first viewed/opened by any user';
COMMENT ON COLUMN "calls"."first_viewed_by" IS 'User who first viewed/opened this call';
COMMENT ON COLUMN "email_messages"."first_viewed_at" IS 'Timestamp when this email was first viewed/opened by any user';
COMMENT ON COLUMN "email_messages"."first_viewed_by" IS 'User who first viewed/opened this email';
