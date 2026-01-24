-- Fix email_connections table - add missing columns
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/cyygkhwujcrbhzgjqipj/sql

ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS error_message TEXT;
ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS sync_from_date DATE;

-- Verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'email_connections'
ORDER BY ordinal_position;
