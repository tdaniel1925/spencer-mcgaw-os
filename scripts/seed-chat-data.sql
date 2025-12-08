-- Seed Chat Data for Spencer McGaw Hub
-- Run this in Supabase Dashboard SQL Editor after creating the chat tables

-- First, let's check what users we have
-- SELECT id, email, full_name FROM users LIMIT 5;

-- Create General community room if it doesn't exist
INSERT INTO chat_rooms (id, name, type, description, created_by)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'General',
  'community',
  'General discussion for all team members',
  (SELECT id FROM users LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM chat_rooms WHERE name = 'General' AND type = 'community'
);

-- Create Announcements room
INSERT INTO chat_rooms (id, name, type, description, created_by)
SELECT
  'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid,
  'Announcements',
  'community',
  'Important team announcements',
  (SELECT id FROM users LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM chat_rooms WHERE name = 'Announcements' AND type = 'community'
);

-- Add all users to community rooms
INSERT INTO chat_room_members (room_id, user_id, role)
SELECT r.id, u.id, 'member'
FROM chat_rooms r
CROSS JOIN users u
WHERE r.type = 'community'
ON CONFLICT (room_id, user_id) DO NOTHING;

-- Get General room id for messages
DO $$
DECLARE
  general_room_id UUID;
  announcements_room_id UUID;
  user1_id UUID;
  user2_id UUID;
BEGIN
  -- Get room IDs
  SELECT id INTO general_room_id FROM chat_rooms WHERE name = 'General' AND type = 'community' LIMIT 1;
  SELECT id INTO announcements_room_id FROM chat_rooms WHERE name = 'Announcements' AND type = 'community' LIMIT 1;

  -- Get first two users
  SELECT id INTO user1_id FROM users ORDER BY created_at LIMIT 1;
  SELECT id INTO user2_id FROM users ORDER BY created_at OFFSET 1 LIMIT 1;

  -- If we don't have a second user, use the first one for all messages
  IF user2_id IS NULL THEN
    user2_id := user1_id;
  END IF;

  -- Insert General room messages
  IF general_room_id IS NOT NULL AND user1_id IS NOT NULL THEN
    INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at) VALUES
      (general_room_id, user1_id, 'Hey everyone! Welcome to the new chat system', 'text', NOW() - INTERVAL '2 hours'),
      (general_room_id, user2_id, 'This is awesome! Great job on the implementation.', 'text', NOW() - INTERVAL '115 minutes'),
      (general_room_id, user1_id, 'Thanks! Let me know if you find any bugs.', 'text', NOW() - INTERVAL '110 minutes'),
      (general_room_id, user2_id, 'Will do. The typing indicator is a nice touch!', 'text', NOW() - INTERVAL '100 minutes'),
      (general_room_id, user1_id, 'Yeah, it uses Supabase Realtime for instant updates', 'text', NOW() - INTERVAL '95 minutes'),
      (general_room_id, user2_id, 'Can we create private DMs too?', 'text', NOW() - INTERVAL '60 minutes'),
      (general_room_id, user1_id, 'Yes! Click the + button in the sidebar and select a user', 'text', NOW() - INTERVAL '55 minutes'),
      (general_room_id, user2_id, 'Perfect, I will try it out now', 'text', NOW() - INTERVAL '50 minutes'),
      (general_room_id, user1_id, 'Anyone else online? We should discuss the new client proposal', 'text', NOW() - INTERVAL '30 minutes'),
      (general_room_id, user2_id, 'I am here. What is the timeline looking like?', 'text', NOW() - INTERVAL '25 minutes'),
      (general_room_id, user1_id, 'They want it done by end of month', 'text', NOW() - INTERVAL '20 minutes'),
      (general_room_id, user2_id, 'That is tight but doable. Let us sync up tomorrow morning.', 'text', NOW() - INTERVAL '15 minutes'),
      (general_room_id, user1_id, 'Sounds good! I will set up a meeting invite.', 'text', NOW() - INTERVAL '10 minutes')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Insert Announcements room messages
  IF announcements_room_id IS NOT NULL AND user1_id IS NOT NULL THEN
    INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at) VALUES
      (announcements_room_id, user1_id, 'Team meeting tomorrow at 10am', 'text', NOW() - INTERVAL '3 hours'),
      (announcements_room_id, user1_id, 'Please submit your weekly reports by Friday 5pm', 'text', NOW() - INTERVAL '90 minutes'),
      (announcements_room_id, user1_id, 'New client onboarding checklist is now available in Files', 'text', NOW() - INTERVAL '45 minutes')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Create a private DM if we have 2 different users
  IF user1_id IS NOT NULL AND user2_id IS NOT NULL AND user1_id != user2_id THEN
    -- Create DM room
    INSERT INTO chat_rooms (id, type, created_by)
    VALUES ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, 'private', user1_id)
    ON CONFLICT DO NOTHING;

    -- Add members to DM
    INSERT INTO chat_room_members (room_id, user_id, role) VALUES
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user1_id, 'member'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user2_id, 'member')
    ON CONFLICT (room_id, user_id) DO NOTHING;

    -- Add DM messages
    INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at) VALUES
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user1_id, 'Hey, got a sec?', 'text', NOW() - INTERVAL '45 minutes'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user2_id, 'Sure, what is up?', 'text', NOW() - INTERVAL '43 minutes'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user1_id, 'I was looking at the Spencer McGaw project files', 'text', NOW() - INTERVAL '40 minutes'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user1_id, 'There is a discrepancy in the budget numbers', 'text', NOW() - INTERVAL '39 minutes'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user2_id, 'Oh? Which line items?', 'text', NOW() - INTERVAL '35 minutes'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user1_id, 'The Q4 projections do not match the updated estimates', 'text', NOW() - INTERVAL '32 minutes'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user2_id, 'Let me check... you are right. I will fix that today.', 'text', NOW() - INTERVAL '28 minutes'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user1_id, 'Thanks! Also, can you ping me when the client calls back?', 'text', NOW() - INTERVAL '25 minutes'),
      ('c3d4e5f6-a7b8-9012-cdef-345678901234'::uuid, user2_id, 'Will do!', 'text', NOW() - INTERVAL '22 minutes')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Verify data was created
SELECT 'Rooms created:' as info, COUNT(*) as count FROM chat_rooms;
SELECT 'Members added:' as info, COUNT(*) as count FROM chat_room_members;
SELECT 'Messages added:' as info, COUNT(*) as count FROM chat_messages;
