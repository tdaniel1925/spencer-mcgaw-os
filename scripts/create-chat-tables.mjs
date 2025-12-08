import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jvqwlwctgzitskcrtvqp.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2cXdsd2N0Z3ppdHNrY3J0dnFwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzQxNDYyNywiZXhwIjoyMDYyOTkwNjI3fQ.IHj3LaYzGioiZLPCwOKnPHPjBnyFLONadJmN6hjjbxc";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createChatTables() {
  console.log("Creating chat tables...");

  // Create chat_rooms table
  const { error: roomsError } = await supabase.rpc("exec_sql", {
    sql: `
      -- Chat rooms table (community rooms and private DMs)
      CREATE TABLE IF NOT EXISTS chat_rooms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255),
        type VARCHAR(50) NOT NULL DEFAULT 'private', -- 'community', 'private', 'group'
        description TEXT,
        created_by UUID REFERENCES auth.users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        is_archived BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type);
      CREATE INDEX IF NOT EXISTS idx_chat_rooms_created_by ON chat_rooms(created_by);
    `
  });

  if (roomsError) {
    console.log("Creating chat_rooms via direct SQL...");
    // Try direct table creation
    const { error } = await supabase.from("chat_rooms").select("id").limit(1);
    if (error && error.code === "42P01") {
      console.error("Table doesn't exist, need to create manually");
    }
  }

  // Create chat_room_members table
  const { error: membersError } = await supabase.rpc("exec_sql", {
    sql: `
      -- Chat room members (for private chats and group membership)
      CREATE TABLE IF NOT EXISTS chat_room_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        role VARCHAR(50) DEFAULT 'member', -- 'admin', 'member'
        joined_at TIMESTAMPTZ DEFAULT NOW(),
        last_read_at TIMESTAMPTZ DEFAULT NOW(),
        notifications_enabled BOOLEAN DEFAULT TRUE,
        UNIQUE(room_id, user_id)
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_chat_room_members_room ON chat_room_members(room_id);
      CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON chat_room_members(user_id);
    `
  });

  // Create chat_messages table
  const { error: messagesError } = await supabase.rpc("exec_sql", {
    sql: `
      -- Chat messages
      CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth.users(id),
        content TEXT NOT NULL,
        message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'file', 'system'
        reply_to UUID REFERENCES chat_messages(id),
        is_edited BOOLEAN DEFAULT FALSE,
        is_deleted BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'
      );

      -- Create indexes
      CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
    `
  });

  // Create typing_indicators table (for real-time typing status)
  const { error: typingError } = await supabase.rpc("exec_sql", {
    sql: `
      -- Typing indicators (ephemeral, auto-cleaned)
      CREATE TABLE IF NOT EXISTS chat_typing_indicators (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(room_id, user_id)
      );

      -- Create index
      CREATE INDEX IF NOT EXISTS idx_chat_typing_room ON chat_typing_indicators(room_id);
    `
  });

  // Create user presence table
  const { error: presenceError } = await supabase.rpc("exec_sql", {
    sql: `
      -- User presence (online/offline status)
      CREATE TABLE IF NOT EXISTS chat_user_presence (
        user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'offline', -- 'online', 'away', 'offline'
        last_seen_at TIMESTAMPTZ DEFAULT NOW()
      );
    `
  });

  // Enable RLS
  const { error: rlsError } = await supabase.rpc("exec_sql", {
    sql: `
      -- Enable RLS on all chat tables
      ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
      ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
      ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE chat_typing_indicators ENABLE ROW LEVEL SECURITY;
      ALTER TABLE chat_user_presence ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Users can view community rooms" ON chat_rooms;
      DROP POLICY IF EXISTS "Users can view rooms they are members of" ON chat_rooms;
      DROP POLICY IF EXISTS "Users can create rooms" ON chat_rooms;
      DROP POLICY IF EXISTS "Users can view their memberships" ON chat_room_members;
      DROP POLICY IF EXISTS "Users can join community rooms" ON chat_room_members;
      DROP POLICY IF EXISTS "Room creators can add members" ON chat_room_members;
      DROP POLICY IF EXISTS "Users can view messages in their rooms" ON chat_messages;
      DROP POLICY IF EXISTS "Users can send messages to their rooms" ON chat_messages;
      DROP POLICY IF EXISTS "Users can edit their own messages" ON chat_messages;
      DROP POLICY IF EXISTS "Users can view typing in their rooms" ON chat_typing_indicators;
      DROP POLICY IF EXISTS "Users can set their typing status" ON chat_typing_indicators;
      DROP POLICY IF EXISTS "Users can view presence" ON chat_user_presence;
      DROP POLICY IF EXISTS "Users can update their presence" ON chat_user_presence;

      -- Chat rooms policies
      CREATE POLICY "Users can view community rooms" ON chat_rooms
        FOR SELECT USING (type = 'community');

      CREATE POLICY "Users can view rooms they are members of" ON chat_rooms
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM chat_room_members
            WHERE chat_room_members.room_id = chat_rooms.id
            AND chat_room_members.user_id = auth.uid()
          )
        );

      CREATE POLICY "Users can create rooms" ON chat_rooms
        FOR INSERT WITH CHECK (auth.uid() = created_by);

      -- Chat room members policies
      CREATE POLICY "Users can view their memberships" ON chat_room_members
        FOR SELECT USING (user_id = auth.uid() OR EXISTS (
          SELECT 1 FROM chat_room_members m2
          WHERE m2.room_id = chat_room_members.room_id
          AND m2.user_id = auth.uid()
        ));

      CREATE POLICY "Users can join community rooms" ON chat_room_members
        FOR INSERT WITH CHECK (
          user_id = auth.uid() AND
          EXISTS (SELECT 1 FROM chat_rooms WHERE id = room_id AND type = 'community')
        );

      CREATE POLICY "Room creators can add members" ON chat_room_members
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM chat_rooms
            WHERE id = room_id AND created_by = auth.uid()
          )
        );

      -- Chat messages policies
      CREATE POLICY "Users can view messages in their rooms" ON chat_messages
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM chat_room_members
            WHERE chat_room_members.room_id = chat_messages.room_id
            AND chat_room_members.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM chat_rooms
            WHERE chat_rooms.id = chat_messages.room_id
            AND chat_rooms.type = 'community'
          )
        );

      CREATE POLICY "Users can send messages to their rooms" ON chat_messages
        FOR INSERT WITH CHECK (
          user_id = auth.uid() AND (
            EXISTS (
              SELECT 1 FROM chat_room_members
              WHERE chat_room_members.room_id = chat_messages.room_id
              AND chat_room_members.user_id = auth.uid()
            )
            OR EXISTS (
              SELECT 1 FROM chat_rooms
              WHERE chat_rooms.id = chat_messages.room_id
              AND chat_rooms.type = 'community'
            )
          )
        );

      CREATE POLICY "Users can edit their own messages" ON chat_messages
        FOR UPDATE USING (user_id = auth.uid());

      -- Typing indicators policies
      CREATE POLICY "Users can view typing in their rooms" ON chat_typing_indicators
        FOR SELECT USING (
          EXISTS (
            SELECT 1 FROM chat_room_members
            WHERE chat_room_members.room_id = chat_typing_indicators.room_id
            AND chat_room_members.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM chat_rooms
            WHERE chat_rooms.id = chat_typing_indicators.room_id
            AND chat_rooms.type = 'community'
          )
        );

      CREATE POLICY "Users can set their typing status" ON chat_typing_indicators
        FOR ALL USING (user_id = auth.uid());

      -- User presence policies
      CREATE POLICY "Users can view presence" ON chat_user_presence
        FOR SELECT USING (true);

      CREATE POLICY "Users can update their presence" ON chat_user_presence
        FOR ALL USING (user_id = auth.uid());
    `
  });

  // Enable realtime for chat tables
  const { error: realtimeError } = await supabase.rpc("exec_sql", {
    sql: `
      -- Enable realtime for chat tables
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_indicators;
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_user_presence;
      ALTER PUBLICATION supabase_realtime ADD TABLE chat_room_members;
    `
  });

  // Create default community room
  const { data: existingRoom } = await supabase
    .from("chat_rooms")
    .select("id")
    .eq("type", "community")
    .eq("name", "General")
    .single();

  if (!existingRoom) {
    const { error: createRoomError } = await supabase
      .from("chat_rooms")
      .insert({
        name: "General",
        type: "community",
        description: "General discussion for all team members"
      });

    if (createRoomError) {
      console.log("Could not create default room (may need manual creation):", createRoomError.message);
    } else {
      console.log("Created default General community room");
    }
  }

  console.log("Chat tables setup complete!");
  console.log("\nIf tables weren't created, run this SQL in Supabase Dashboard:");
  console.log(`
-- Chat rooms table
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255),
  type VARCHAR(50) NOT NULL DEFAULT 'private',
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}'
);

-- Chat room members
CREATE TABLE IF NOT EXISTS chat_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  notifications_enabled BOOLEAN DEFAULT TRUE,
  UNIQUE(room_id, user_id)
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'text',
  reply_to UUID REFERENCES chat_messages(id),
  is_edited BOOLEAN DEFAULT FALSE,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'
);

-- Typing indicators
CREATE TABLE IF NOT EXISTS chat_typing_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(room_id, user_id)
);

-- User presence
CREATE TABLE IF NOT EXISTS chat_user_presence (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status VARCHAR(50) DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room ON chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_typing_room ON chat_typing_indicators(room_id);

-- Enable RLS
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_typing_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_user_presence ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing_indicators;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_user_presence;

-- Create default community room
INSERT INTO chat_rooms (name, type, description)
VALUES ('General', 'community', 'General discussion for all team members')
ON CONFLICT DO NOTHING;
  `);
}

createChatTables().catch(console.error);
