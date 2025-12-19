-- Migration: Chat Enhancements
-- Created: 2025-12-19
-- Description: Adds presence tracking, message reactions, mentions, and message search

-- ============================================================================
-- 1. USER PRESENCE TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_presence (
  user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'offline', -- online, away, busy, offline
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  current_room_id UUID REFERENCES chat_rooms(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}', -- e.g., device type, location
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for presence lookups
CREATE INDEX IF NOT EXISTS idx_user_presence_status ON user_presence(status) WHERE status = 'online';
CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence(last_seen_at DESC);

-- ============================================================================
-- 2. MESSAGE REACTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  emoji VARCHAR(20) NOT NULL, -- e.g., 👍, ❤️, 😂
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id, emoji) -- One reaction type per user per message
);

-- Indexes for reaction queries
CREATE INDEX IF NOT EXISTS idx_reactions_message ON chat_message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON chat_message_reactions(user_id);

-- ============================================================================
-- 3. MESSAGE MENTIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS chat_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, mentioned_user_id)
);

-- Indexes for mention queries
CREATE INDEX IF NOT EXISTS idx_mentions_message ON chat_mentions(message_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON chat_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_mentions_unread ON chat_mentions(mentioned_user_id, is_read) WHERE is_read = false;

-- ============================================================================
-- 4. ADD EDITED FIELDS TO CHAT_MESSAGES IF NOT EXISTS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'edited_at'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN edited_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'original_content'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN original_content TEXT;
  END IF;
END $$;

-- ============================================================================
-- 5. ADD is_deleted FIELD IF NOT EXISTS (for soft delete)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- 6. ADD attachments FIELD IF NOT EXISTS
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'attachments'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN attachments JSONB DEFAULT '[]';
  END IF;
END $$;

-- ============================================================================
-- 7. FULL TEXT SEARCH INDEX FOR MESSAGES
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_messages_content_search'
  ) THEN
    CREATE INDEX idx_messages_content_search ON chat_messages USING gin(to_tsvector('english', content));
  END IF;
END $$;

-- ============================================================================
-- 8. ENABLE REALTIME FOR NEW TABLES
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'user_presence'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE user_presence;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_message_reactions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_message_reactions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'chat_mentions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_mentions;
  END IF;
END $$;

-- ============================================================================
-- 9. ROW LEVEL SECURITY POLICIES
-- ============================================================================

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_mentions ENABLE ROW LEVEL SECURITY;

-- Presence: Everyone can view presence, users can update their own
CREATE POLICY "View all presence" ON user_presence
  FOR SELECT USING (true);

CREATE POLICY "Update own presence" ON user_presence
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Insert own presence" ON user_presence
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Reactions: Users in room can view, authenticated users can add their own
CREATE POLICY "View reactions" ON chat_message_reactions
  FOR SELECT USING (true);

CREATE POLICY "Add own reaction" ON chat_message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Remove own reaction" ON chat_message_reactions
  FOR DELETE USING (user_id = auth.uid());

-- Mentions: Users can view their mentions, system can insert
CREATE POLICY "View own mentions" ON chat_mentions
  FOR SELECT USING (mentioned_user_id = auth.uid());

CREATE POLICY "Insert mentions" ON chat_mentions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Update own mentions" ON chat_mentions
  FOR UPDATE USING (mentioned_user_id = auth.uid());

-- ============================================================================
-- 10. PRESENCE CLEANUP FUNCTION
-- ============================================================================
CREATE OR REPLACE FUNCTION mark_offline_users()
RETURNS void AS $$
BEGIN
  -- Mark users as offline if they haven't updated in 5 minutes
  UPDATE user_presence
  SET status = 'offline', updated_at = NOW()
  WHERE status != 'offline'
    AND updated_at < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 11. RLS POLICIES FOR CORE CHAT TABLES
-- ============================================================================

-- Enable RLS on chat tables (safe to run multiple times)
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_indicators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "View community rooms" ON chat_rooms;
DROP POLICY IF EXISTS "View member rooms" ON chat_rooms;
DROP POLICY IF EXISTS "Create rooms" ON chat_rooms;
DROP POLICY IF EXISTS "View room messages" ON chat_messages;
DROP POLICY IF EXISTS "Send messages" ON chat_messages;
DROP POLICY IF EXISTS "Edit own messages" ON chat_messages;
DROP POLICY IF EXISTS "View room members" ON chat_room_members;
DROP POLICY IF EXISTS "Join community rooms" ON chat_room_members;
DROP POLICY IF EXISTS "Manage own membership" ON chat_room_members;
DROP POLICY IF EXISTS "Admin manage members" ON chat_room_members;
DROP POLICY IF EXISTS "View typing indicators" ON chat_typing_indicators;
DROP POLICY IF EXISTS "Set own typing" ON chat_typing_indicators;
DROP POLICY IF EXISTS "Delete own typing" ON chat_typing_indicators;

-- CHAT_ROOMS policies
CREATE POLICY "View community rooms" ON chat_rooms
  FOR SELECT USING (type = 'community' AND is_archived = false);

CREATE POLICY "View member rooms" ON chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_room_members
      WHERE room_id = chat_rooms.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Create rooms" ON chat_rooms
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- CHAT_MESSAGES policies
CREATE POLICY "View room messages" ON chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = chat_messages.room_id
      AND (
        r.type = 'community' OR
        EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = r.id AND user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Send messages" ON chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = room_id
      AND (
        r.type = 'community' OR
        EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = r.id AND user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Edit own messages" ON chat_messages
  FOR UPDATE USING (user_id = auth.uid());

-- CHAT_ROOM_MEMBERS policies
CREATE POLICY "View room members" ON chat_room_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_rooms r
      WHERE r.id = room_id
      AND (
        r.type = 'community' OR
        EXISTS (SELECT 1 FROM chat_room_members crm WHERE crm.room_id = r.id AND crm.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Join community rooms" ON chat_room_members
  FOR INSERT WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (SELECT 1 FROM chat_rooms WHERE id = room_id AND type = 'community')
  );

CREATE POLICY "Manage own membership" ON chat_room_members
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admin manage members" ON chat_room_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_room_members.room_id
      AND crm.user_id = auth.uid()
      AND crm.role = 'admin'
    )
  );

-- CHAT_TYPING_INDICATORS policies
CREATE POLICY "View typing indicators" ON chat_typing_indicators
  FOR SELECT USING (true);

CREATE POLICY "Set own typing" ON chat_typing_indicators
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Delete own typing" ON chat_typing_indicators
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- 12. AUTO-ADD NEW USERS TO COMMUNITY ROOMS
-- ============================================================================

-- Function to add user to all community rooms
CREATE OR REPLACE FUNCTION add_user_to_community_rooms()
RETURNS TRIGGER AS $$
BEGIN
  -- Add new user to all community rooms
  INSERT INTO chat_room_members (room_id, user_id, role)
  SELECT id, NEW.id, 'member'
  FROM chat_rooms
  WHERE type = 'community' AND is_archived = false
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on user_profiles table
DROP TRIGGER IF EXISTS auto_join_community_rooms ON user_profiles;
CREATE TRIGGER auto_join_community_rooms
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION add_user_to_community_rooms();

-- Also add existing users who might be missing from community rooms
INSERT INTO chat_room_members (room_id, user_id, role)
SELECT r.id, u.id, 'member'
FROM chat_rooms r
CROSS JOIN user_profiles u
WHERE r.type = 'community' AND r.is_archived = false
ON CONFLICT (room_id, user_id) DO NOTHING;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
