import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jvqwlwctgzitskcrtvqp.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2cXdsd2N0Z3ppdHNrY3J0dnFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzQxNDYyNywiZXhwIjoyMDYyOTkwNjI3fQ.IHj3LaYzGioiZLPCwOKnPHPjBnyFLONadJmN6hjjbxc";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedChatData() {
  console.log("Seeding chat data...");

  // Get existing users
  const { data: users, error: usersError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .limit(10);

  if (usersError) {
    console.error("Error fetching users:", usersError);
    return;
  }

  console.log(`Found ${users?.length || 0} users:`, users?.map(u => u.full_name || u.email));

  if (!users || users.length < 2) {
    console.log("Need at least 2 users for chat. Creating mock profiles...");

    // Create mock users if needed - but they need to be in auth.users first
    console.log("Note: You need to have users registered in the app to chat.");
    console.log("The chat system uses existing users from the profiles table.");
    return;
  }

  // Create or get the General community room
  let generalRoom;
  const { data: existingGeneral } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("type", "community")
    .eq("name", "General")
    .single();

  if (existingGeneral) {
    generalRoom = existingGeneral;
    console.log("Found existing General room:", generalRoom.id);
  } else {
    const { data: newRoom, error: roomError } = await supabase
      .from("chat_rooms")
      .insert({
        name: "General",
        type: "community",
        description: "General discussion for all team members",
        created_by: users[0].id
      })
      .select()
      .single();

    if (roomError) {
      console.error("Error creating General room:", roomError);
      return;
    }
    generalRoom = newRoom;
    console.log("Created General room:", generalRoom.id);
  }

  // Add all users to the General room
  for (const user of users) {
    const { error: memberError } = await supabase
      .from("chat_room_members")
      .upsert({
        room_id: generalRoom.id,
        user_id: user.id,
        role: "member"
      }, { onConflict: "room_id,user_id" });

    if (memberError && !memberError.message.includes("duplicate")) {
      console.log(`Note: Could not add ${user.full_name || user.email} to General:`, memberError.message);
    }
  }
  console.log("Added users to General room");

  // Add mock messages to General room
  const generalMessages = [
    { user_idx: 0, content: "Hey everyone! Welcome to the new chat system 🎉", mins_ago: 120 },
    { user_idx: 1, content: "This is awesome! Great job on the implementation.", mins_ago: 115 },
    { user_idx: 0, content: "Thanks! Let me know if you find any bugs.", mins_ago: 110 },
    { user_idx: 1, content: "Will do. The typing indicator is a nice touch!", mins_ago: 100 },
    { user_idx: 0, content: "Yeah, it uses Supabase Realtime for instant updates", mins_ago: 95 },
    { user_idx: 1, content: "Can we create private DMs too?", mins_ago: 60 },
    { user_idx: 0, content: "Yes! Click the + button in the sidebar and select a user", mins_ago: 55 },
    { user_idx: 1, content: "Perfect, I'll try it out now", mins_ago: 50 },
    { user_idx: 0, content: "Anyone else online? We should discuss the new client proposal", mins_ago: 30 },
    { user_idx: 1, content: "I'm here. What's the timeline looking like?", mins_ago: 25 },
    { user_idx: 0, content: "They want it done by end of month", mins_ago: 20 },
    { user_idx: 1, content: "That's tight but doable. Let's sync up tomorrow morning.", mins_ago: 15 },
    { user_idx: 0, content: "Sounds good! I'll set up a meeting invite.", mins_ago: 10 },
  ];

  for (const msg of generalMessages) {
    if (users[msg.user_idx]) {
      const createdAt = new Date(Date.now() - msg.mins_ago * 60 * 1000).toISOString();
      const { error: msgError } = await supabase
        .from("chat_messages")
        .insert({
          room_id: generalRoom.id,
          user_id: users[msg.user_idx].id,
          content: msg.content,
          message_type: "text",
          created_at: createdAt
        });

      if (msgError) {
        console.log(`Note: Could not add message:`, msgError.message);
      }
    }
  }
  console.log("Added messages to General room");

  // Create a private DM room between first two users if we have enough users
  if (users.length >= 2) {
    // Check if DM already exists
    const { data: existingDM } = await supabase
      .from("chat_rooms")
      .select(`
        *,
        chat_room_members!inner(user_id)
      `)
      .eq("type", "private");

    let dmRoom;
    const existingDMWithBothUsers = existingDM?.find(room => {
      const memberIds = room.chat_room_members.map((m) => m.user_id);
      return memberIds.includes(users[0].id) && memberIds.includes(users[1].id);
    });

    if (existingDMWithBothUsers) {
      dmRoom = existingDMWithBothUsers;
      console.log("Found existing DM room:", dmRoom.id);
    } else {
      const { data: newDM, error: dmError } = await supabase
        .from("chat_rooms")
        .insert({
          type: "private",
          created_by: users[0].id
        })
        .select()
        .single();

      if (dmError) {
        console.error("Error creating DM room:", dmError);
      } else {
        dmRoom = newDM;
        console.log("Created DM room:", dmRoom.id);

        // Add both users to DM
        await supabase.from("chat_room_members").insert([
          { room_id: dmRoom.id, user_id: users[0].id, role: "member" },
          { room_id: dmRoom.id, user_id: users[1].id, role: "member" }
        ]);
      }
    }

    // Add DM messages
    if (dmRoom) {
      const dmMessages = [
        { user_idx: 0, content: "Hey, got a sec?", mins_ago: 45 },
        { user_idx: 1, content: "Sure, what's up?", mins_ago: 43 },
        { user_idx: 0, content: "I was looking at the Spencer McGaw project files", mins_ago: 40 },
        { user_idx: 0, content: "There's a discrepancy in the budget numbers", mins_ago: 39 },
        { user_idx: 1, content: "Oh? Which line items?", mins_ago: 35 },
        { user_idx: 0, content: "The Q4 projections don't match the updated estimates", mins_ago: 32 },
        { user_idx: 1, content: "Let me check... you're right. I'll fix that today.", mins_ago: 28 },
        { user_idx: 0, content: "Thanks! Also, can you ping me when the client calls back?", mins_ago: 25 },
        { user_idx: 1, content: "Will do 👍", mins_ago: 22 },
      ];

      for (const msg of dmMessages) {
        if (users[msg.user_idx]) {
          const createdAt = new Date(Date.now() - msg.mins_ago * 60 * 1000).toISOString();
          await supabase.from("chat_messages").insert({
            room_id: dmRoom.id,
            user_id: users[msg.user_idx].id,
            content: msg.content,
            message_type: "text",
            created_at: createdAt
          });
        }
      }
      console.log("Added messages to DM room");
    }
  }

  // Create another community room - "Announcements"
  let announcementsRoom;
  const { data: existingAnnouncements } = await supabase
    .from("chat_rooms")
    .select("*")
    .eq("type", "community")
    .eq("name", "Announcements")
    .single();

  if (!existingAnnouncements) {
    const { data: newRoom, error } = await supabase
      .from("chat_rooms")
      .insert({
        name: "Announcements",
        type: "community",
        description: "Important team announcements",
        created_by: users[0].id
      })
      .select()
      .single();

    if (!error) {
      announcementsRoom = newRoom;
      console.log("Created Announcements room");

      // Add all users
      for (const user of users) {
        await supabase.from("chat_room_members").upsert({
          room_id: announcementsRoom.id,
          user_id: user.id,
          role: "member"
        }, { onConflict: "room_id,user_id" });
      }

      // Add announcement messages
      const announcements = [
        { user_idx: 0, content: "📢 Team meeting tomorrow at 10am", mins_ago: 180 },
        { user_idx: 0, content: "Please submit your weekly reports by Friday 5pm", mins_ago: 90 },
        { user_idx: 0, content: "New client onboarding checklist is now available in Files", mins_ago: 45 },
      ];

      for (const msg of announcements) {
        if (users[msg.user_idx]) {
          const createdAt = new Date(Date.now() - msg.mins_ago * 60 * 1000).toISOString();
          await supabase.from("chat_messages").insert({
            room_id: announcementsRoom.id,
            user_id: users[msg.user_idx].id,
            content: msg.content,
            message_type: "text",
            created_at: createdAt
          });
        }
      }
      console.log("Added messages to Announcements room");
    }
  }

  console.log("\n✅ Chat data seeding complete!");
  console.log("You should now see rooms and messages in the Chat page.");
}

seedChatData().catch(console.error);
