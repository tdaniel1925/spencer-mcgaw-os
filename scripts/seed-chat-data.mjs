import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tpwylybunpgvkeqxnqsv.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwd3lseWJ1bnBndmtlcXhucXN2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODI5MzAzNCwiZXhwIjoyMDYzODY5MDM0fQ.U_Mc8A2yoFmNPiUavwKLbVPW9cgez75m7K2IkyB8TCs'
);

async function seedChatData() {
  console.log('Seeding chat data...\n');

  // Get first user
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name')
    .limit(1);

  if (userError || !users?.length) {
    console.error('No users found:', userError?.message);
    console.log('\nYou need at least one user in the system. Log in to the app first.');
    return;
  }

  const userId = users[0].id;
  console.log(`Using user: ${users[0].full_name || users[0].email} (${userId})\n`);

  // Create community rooms
  const roomIds = {
    general: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    announcements: 'b2c3d4e5-f6a7-8901-bcde-f23456789012'
  };

  const { error: roomError } = await supabase
    .from('chat_rooms')
    .upsert([
      {
        id: roomIds.general,
        name: 'General',
        type: 'community',
        description: 'General discussion for all team members',
        is_archived: false
      },
      {
        id: roomIds.announcements,
        name: 'Announcements',
        type: 'community',
        description: 'Important team announcements',
        is_archived: false
      }
    ], { onConflict: 'id' });

  if (roomError) {
    console.error('Error creating rooms:', roomError.message);
    return;
  }
  console.log('✓ Created 2 community rooms');

  // Add user as member of both rooms
  const { error: memberError } = await supabase
    .from('chat_room_members')
    .upsert([
      { room_id: roomIds.general, user_id: userId, role: 'member' },
      { room_id: roomIds.announcements, user_id: userId, role: 'member' }
    ], { onConflict: 'room_id,user_id' });

  if (memberError) {
    console.error('Error adding member:', memberError.message);
    return;
  }
  console.log('✓ Added user as member');

  // Add messages to General room
  const generalMessages = [
    { content: 'Welcome to the General chat! This is where we discuss day-to-day topics.', minutes_ago: 120 },
    { content: 'Feel free to start conversations here.', minutes_ago: 90 },
    { content: 'The chat supports real-time updates - try opening in two tabs!', minutes_ago: 60 },
    { content: 'You can also create private DMs with the + button.', minutes_ago: 30 },
    { content: 'Looking forward to chatting with the team!', minutes_ago: 10 }
  ];

  const announcementMessages = [
    { content: 'Welcome to Spencer McGaw Business OS!', minutes_ago: 180 },
    { content: 'This channel is for important team announcements.', minutes_ago: 120 },
    { content: 'New chat feature is now live - enjoy real-time messaging!', minutes_ago: 30 }
  ];

  const allMessages = [
    ...generalMessages.map(m => ({
      room_id: roomIds.general,
      user_id: userId,
      content: m.content,
      message_type: 'text',
      created_at: new Date(Date.now() - m.minutes_ago * 60 * 1000).toISOString()
    })),
    ...announcementMessages.map(m => ({
      room_id: roomIds.announcements,
      user_id: userId,
      content: m.content,
      message_type: 'text',
      created_at: new Date(Date.now() - m.minutes_ago * 60 * 1000).toISOString()
    }))
  ];

  const { error: msgError } = await supabase
    .from('chat_messages')
    .insert(allMessages);

  if (msgError) {
    console.error('Error creating messages:', msgError.message);
    return;
  }
  console.log(`✓ Created ${allMessages.length} messages`);

  // Verify
  const { count: roomCount } = await supabase.from('chat_rooms').select('*', { count: 'exact', head: true });
  const { count: memberCount } = await supabase.from('chat_room_members').select('*', { count: 'exact', head: true });
  const { count: messageCount } = await supabase.from('chat_messages').select('*', { count: 'exact', head: true });

  console.log('\n--- Verification ---');
  console.log(`Rooms: ${roomCount}`);
  console.log(`Members: ${memberCount}`);
  console.log(`Messages: ${messageCount}`);
  console.log('\n✅ Chat data seeded successfully!');
  console.log('Go to http://localhost:3000/chat to see the chat.');
}

seedChatData().catch(console.error);
