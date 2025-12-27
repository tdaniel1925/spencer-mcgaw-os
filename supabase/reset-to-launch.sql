-- =====================================================
-- RESET DATABASE TO LAUNCH-READY STATE
-- =====================================================
-- Run this in Supabase SQL Editor
-- Preserves: tdaniel@botmakers.ai as admin
-- Clears: All data except admin user
-- =====================================================

-- Get admin user ID
DO $$
DECLARE
  admin_id UUID;
BEGIN
  -- Find admin in user_profiles by email
  SELECT id INTO admin_id FROM user_profiles WHERE email = 'tdaniel@botmakers.ai';

  IF admin_id IS NULL THEN
    RAISE NOTICE 'Admin user not found - will need to be created via auth signup';
  ELSE
    RAISE NOTICE 'Found admin user: %', admin_id;
  END IF;

  -- =====================================================
  -- CLEAR DATA TABLES (in FK order)
  -- =====================================================

  -- File system
  RAISE NOTICE 'Clearing file system tables...';
  DELETE FROM file_activity;
  DELETE FROM file_versions;
  DELETE FROM file_shares;
  DELETE FROM folder_permissions;
  DELETE FROM files;
  DELETE FROM folders;
  DELETE FROM storage_quotas WHERE user_id != admin_id OR admin_id IS NULL;

  -- Chat system
  RAISE NOTICE 'Clearing chat tables...';
  DELETE FROM chat_mentions;
  DELETE FROM chat_message_reactions;
  DELETE FROM chat_typing_indicators;
  DELETE FROM chat_messages;
  DELETE FROM chat_room_members;
  DELETE FROM chat_rooms;
  DELETE FROM user_presence WHERE user_id != admin_id OR admin_id IS NULL;

  -- Core business data
  RAISE NOTICE 'Clearing business data...';
  DELETE FROM webhook_logs;
  DELETE FROM activity_logs;
  DELETE FROM calendar_events;
  DELETE FROM documents;
  DELETE FROM subtasks;
  DELETE FROM tasks;
  DELETE FROM calls;
  DELETE FROM projects;
  DELETE FROM clients;
  DELETE FROM email_accounts;

  -- User profiles (except admin)
  RAISE NOTICE 'Clearing non-admin users...';
  IF admin_id IS NOT NULL THEN
    DELETE FROM user_profiles WHERE id != admin_id;
  END IF;

  -- =====================================================
  -- RESET ADMIN USER
  -- =====================================================
  IF admin_id IS NOT NULL THEN
    RAISE NOTICE 'Resetting admin user...';

    UPDATE user_profiles SET
      full_name = 'Trent Daniel',
      role = 'admin',
      is_active = true,
      notification_preferences = '{"email": true, "sms": false, "dashboard": true}'::jsonb,
      updated_at = NOW()
    WHERE id = admin_id;

    -- Reset storage quota
    INSERT INTO storage_quotas (user_id, quota_bytes, used_bytes, file_count, last_calculated_at, updated_at)
    VALUES (admin_id, 26843545600, 0, 0, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      used_bytes = 0,
      file_count = 0,
      last_calculated_at = NOW(),
      updated_at = NOW();

    -- Reset presence
    INSERT INTO user_presence (user_id, status, last_seen_at, updated_at)
    VALUES (admin_id, 'offline', NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      status = 'offline',
      last_seen_at = NOW(),
      updated_at = NOW();
  END IF;

  -- =====================================================
  -- CREATE DEFAULT CHAT ROOMS
  -- =====================================================
  RAISE NOTICE 'Creating default chat rooms...';

  INSERT INTO chat_rooms (name, slug, description, type, is_private, is_archived)
  VALUES
    ('General', 'general', 'General discussion for the team', 'community', false, false),
    ('Announcements', 'announcements', 'Important company announcements', 'community', false, false)
  ON CONFLICT (slug) DO NOTHING;

  -- Add admin to chat rooms
  IF admin_id IS NOT NULL THEN
    INSERT INTO chat_room_members (room_id, user_id, role)
    SELECT id, admin_id, 'admin'
    FROM chat_rooms
    WHERE type = 'community'
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Database reset complete!';
END $$;

-- =====================================================
-- SUMMARY
-- =====================================================
-- After running this script:
-- 1. All data has been cleared
-- 2. Admin user (tdaniel@botmakers.ai) preserved
-- 3. Default chat rooms created
-- 4. Storage quotas reset
--
-- NOTE: Auth users must be deleted via Supabase Dashboard:
-- Authentication > Users > Delete non-admin users
-- =====================================================

SELECT
  'Reset complete' as status,
  (SELECT COUNT(*) FROM user_profiles) as user_count,
  (SELECT COUNT(*) FROM chat_rooms) as chat_room_count,
  (SELECT COUNT(*) FROM clients) as client_count,
  (SELECT COUNT(*) FROM tasks) as task_count;
