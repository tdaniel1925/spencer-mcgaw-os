-- Seed Chat Data for Spencer McGaw Hub
-- Run this in Supabase Dashboard SQL Editor

-- Step 1: Check existing users
SELECT id, email, full_name FROM user_profiles;

-- Step 2: Create ONE team chat room (type = 'community' so everyone can see it)
INSERT INTO chat_rooms (id, name, type, description, is_archived)
VALUES
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Team Chat', 'community', 'Team chat for everyone', false)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- Step 3: Add all users as members of the team chat
INSERT INTO chat_room_members (room_id, user_id, role)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, id, 'member' FROM user_profiles
ON CONFLICT (room_id, user_id) DO NOTHING;

-- Step 4: Add some welcome messages to the team chat
INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  (SELECT id FROM user_profiles LIMIT 1),
  'Welcome to the team chat!',
  'text',
  NOW() - INTERVAL '2 hours'
WHERE EXISTS (SELECT 1 FROM user_profiles LIMIT 1);

INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  (SELECT id FROM user_profiles LIMIT 1),
  'This is where we can all chat together as a team.',
  'text',
  NOW() - INTERVAL '90 minutes'
WHERE EXISTS (SELECT 1 FROM user_profiles LIMIT 1);

INSERT INTO chat_messages (room_id, user_id, content, message_type, created_at)
SELECT
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid,
  (SELECT id FROM user_profiles LIMIT 1),
  'You can also start private conversations using the "New Message" button.',
  'text',
  NOW() - INTERVAL '60 minutes'
WHERE EXISTS (SELECT 1 FROM user_profiles LIMIT 1);

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
JOIN user_profiles u ON m.user_id = u.id
ORDER BY m.created_at;
