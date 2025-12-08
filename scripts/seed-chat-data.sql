-- Seed Chat Data for Spencer McGaw Hub
-- Run this in Supabase Dashboard SQL Editor after creating the chat tables

-- First check users
SELECT id, email, full_name FROM users LIMIT 5;

-- Create General community room
INSERT INTO chat_rooms (id, name, type, description)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  'General',
  'community',
  'General discussion for all team members'
)
ON CONFLICT (id) DO NOTHING;

-- Create Announcements room
INSERT INTO chat_rooms (id, name, type, description)
VALUES (
  'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid,
  'Announcements',
  'community',
  'Important team announcements'
)
ON CONFLICT (id) DO NOTHING;

-- Add all existing users as members of community rooms
INSERT INTO chat_room_members (room_id, user_id, role)
SELECT r.id, u.id, 'member'
FROM chat_rooms r
CROSS JOIN users u
WHERE r.type = 'community'
ON CONFLICT (room_id, user_id) DO NOTHING;

-- Get first user for messages (works even with just 1 user)
DO $$
DECLARE
  first_user_id UUID;
  general_room_id UUID := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid;
  announcements_room_id UUID := 'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid;
BEGIN
  -- Get first user
  SELECT id INTO first_user_id FROM users LIMIT 1;

  IF first_user_id IS NULL THEN
    RAISE NOTICE 'No users found in database';
    RETURN;
  END IF;

  RAISE NOTICE 'Found user: %', first_user_id;

  -- Insert General room messages
  INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at) VALUES
    (general_room_id, first_user_id, 'Welcome to the General chat! This is where we discuss day-to-day topics.', 'text', NOW() - INTERVAL '2 hours'),
    (general_room_id, first_user_id, 'Feel free to start conversations here.', 'text', NOW() - INTERVAL '90 minutes'),
    (general_room_id, first_user_id, 'The chat supports real-time updates - try opening in two tabs!', 'text', NOW() - INTERVAL '60 minutes'),
    (general_room_id, first_user_id, 'You can also create private DMs with the + button.', 'text', NOW() - INTERVAL '30 minutes'),
    (general_room_id, first_user_id, 'Looking forward to chatting with the team!', 'text', NOW() - INTERVAL '10 minutes');

  -- Insert Announcements room messages
  INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at) VALUES
    (announcements_room_id, first_user_id, 'Welcome to Spencer McGaw Business OS!', 'text', NOW() - INTERVAL '3 hours'),
    (announcements_room_id, first_user_id, 'This channel is for important team announcements.', 'text', NOW() - INTERVAL '2 hours'),
    (announcements_room_id, first_user_id, 'New chat feature is now live - enjoy real-time messaging!', 'text', NOW() - INTERVAL '30 minutes');

  RAISE NOTICE 'Chat data seeded successfully!';
END $$;

-- Verify data was created
SELECT 'Rooms:' as info, COUNT(*) as count FROM chat_rooms;
SELECT 'Members:' as info, COUNT(*) as count FROM chat_room_members;
SELECT 'Messages:' as info, COUNT(*) as count FROM chat_messages;

-- Show the rooms
SELECT id, name, type, description FROM chat_rooms;
