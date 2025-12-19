-- Migration: Auto-initialize user presence for new users
-- Created: 2025-12-19
-- Description: Creates presence records automatically when users are created

-- Step 1: Create trigger function to auto-initialize presence
CREATE OR REPLACE FUNCTION auto_init_user_presence()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_presence (user_id, status, last_seen_at, updated_at)
  VALUES (NEW.id, 'offline', NOW(), NOW())
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Create trigger on user_profiles table
DROP TRIGGER IF EXISTS trigger_auto_init_user_presence ON user_profiles;
CREATE TRIGGER trigger_auto_init_user_presence
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_init_user_presence();

-- Step 3: Initialize presence for any existing users who don't have a record
INSERT INTO user_presence (user_id, status, last_seen_at, updated_at)
SELECT id, 'offline', NOW(), NOW()
FROM user_profiles
WHERE id NOT IN (SELECT user_id FROM user_presence)
ON CONFLICT (user_id) DO NOTHING;

-- MIGRATION COMPLETE
