-- Seed Chat Data for Spencer McGaw Hub
-- Run this in Supabase Dashboard SQL Editor

-- Step 1: Check existing users
SELECT id, email, full_name FROM users;

-- Step 2: Create community rooms (no foreign key constraint)
INSERT INTO chat_rooms (id, name, type, description, is_archived)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'General', 'community', 'General discussion for all team members', false),
  ('b2c3d4e5-f6a7-8901-bcde-f23456789012', 'Announcements', 'community', 'Important team announcements', false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Step 3: Get your user ID and add as member
INSERT INTO chat_room_members (room_id, user_id, role)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, id, 'member' FROM users
ON CONFLICT (room_id, user_id) DO NOTHING;

INSERT INTO chat_room_members (room_id, user_id, role)
SELECT 'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid, id, 'member' FROM users
ON CONFLICT (room_id, user_id) DO NOTHING;

-- Step 4: Add messages using the first user found
INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  (SELECT id FROM users LIMIT 1),
  'Welcome to the General chat! This is where we discuss day-to-day topics.',
  'text',
  NOW() - INTERVAL '2 hours'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1);

INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  (SELECT id FROM users LIMIT 1),
  'Feel free to start conversations here.',
  'text',
  NOW() - INTERVAL '90 minutes'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1);

INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  (SELECT id FROM users LIMIT 1),
  'The chat supports real-time updates - try opening in two tabs!',
  'text',
  NOW() - INTERVAL '60 minutes'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1);

INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  (SELECT id FROM users LIMIT 1),
  'You can also create private DMs with the + button.',
  'text',
  NOW() - INTERVAL '30 minutes'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1);

INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  (SELECT id FROM users LIMIT 1),
  'Looking forward to chatting with the team!',
  'text',
  NOW() - INTERVAL '10 minutes'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1);

-- Announcements messages
INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid,
  (SELECT id FROM users LIMIT 1),
  'Welcome to Spencer McGaw Business OS!',
  'text',
  NOW() - INTERVAL '3 hours'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1);

INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid,
  (SELECT id FROM users LIMIT 1),
  'This channel is for important team announcements.',
  'text',
  NOW() - INTERVAL '2 hours'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1);

INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'b2c3d4e5-f6a7-8901-bcde-f23456789012'::uuid,
  (SELECT id FROM users LIMIT 1),
  'New chat feature is now live - enjoy real-time messaging!',
  'text',
  NOW() - INTERVAL '30 minutes'
WHERE EXISTS (SELECT 1 FROM users LIMIT 1);

-- Step 5: Verify
SELECT 'chat_rooms' as tbl, COUNT(*) as cnt FROM chat_rooms
UNION ALL
SELECT 'chat_room_members', COUNT(*) FROM chat_room_members
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages;

-- Show rooms
SELECT * FROM chat_rooms;

-- Show messages
SELECT m.content, m.created_at, u.full_name
FROM chat_messages m
JOIN users u ON m.user_id = u.id
ORDER BY m.created_at;
