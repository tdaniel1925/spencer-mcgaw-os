-- =====================================================
-- ADD MISSING COLUMNS TO USER_PROFILES
-- =====================================================
-- This migration adds columns that some code expects but
-- were previously on a separate 'users' table.
-- =====================================================

-- Add onboarding columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'onboarding_completed_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
  END IF;

  -- Add notification_preferences if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "dashboard": true}'::jsonb;
  END IF;

  -- Add phone if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN phone TEXT;
  END IF;

  -- Add avatar_url if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================
-- Added columns to user_profiles:
-- - onboarding_completed (BOOLEAN)
-- - onboarding_completed_at (TIMESTAMPTZ)
-- - notification_preferences (JSONB)
-- - phone (TEXT)
-- - avatar_url (TEXT)
-- =====================================================
