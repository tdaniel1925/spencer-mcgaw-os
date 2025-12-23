import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/chat/rooms - Get all rooms user has access to
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get community rooms
    const { data: communityRooms, error: communityError } = await supabase
      .from("chat_rooms")
      .select("*")
      .eq("type", "community")
      .eq("is_archived", false);

    if (communityError) throw communityError;

    // Get private rooms user is a member of
    const { data: memberRooms, error: memberError } = await supabase
      .from("chat_room_members")
      .select(`
        room_id,
        last_read_at,
        chat_rooms (
          id,
          name,
          type,
          description,
          created_by,
          created_at,
          metadata
        )
      `)
      .eq("user_id", user.id);

    if (memberError) throw memberError;

    // Get unread counts for each room
    const rooms = [
      ...(communityRooms || []).map(room => ({ ...room, is_member: true })),
      ...(memberRooms || [])
        .filter(m => m.chat_rooms && (m.chat_rooms as any).type !== "community")
        .map(m => ({
          ...(m.chat_rooms as any),
          last_read_at: m.last_read_at,
          is_member: true
        }))
    ];

    // Batch fetch all data to avoid N+1 queries
    const roomIds = rooms.map(r => r.id);

    // Get last message for all rooms in one query using a CTE/window function approach
    // Supabase doesn't support window functions in select, so we use a different strategy:
    // Get recent messages for all rooms and group client-side
    const { data: recentMessages } = await supabase
      .from("chat_messages")
      .select(`
        id,
        room_id,
        content,
        created_at,
        user_id,
        users:user_id (
          full_name,
          email
        )
      `)
      .in("room_id", roomIds)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(roomIds.length * 2); // Get enough to have at least 1 per room

    // Create a map of room_id -> last message
    type MessageType = NonNullable<typeof recentMessages>[number];
    const lastMessageByRoom: Record<string, MessageType> = {};
    if (recentMessages) {
      for (const msg of recentMessages) {
        if (!lastMessageByRoom[msg.room_id]) {
          lastMessageByRoom[msg.room_id] = msg;
        }
      }
    }

    // Get all unread counts in batch - query messages newer than each room's last_read_at
    // We need to do this per-room due to the varying last_read_at, but we can parallelize
    const unreadCountsPromises = rooms.map(async (room) => {
      const lastReadAt = room.last_read_at || new Date(0).toISOString();
      const { count } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("is_deleted", false)
        .neq("user_id", user.id)
        .gt("created_at", lastReadAt);
      return { roomId: room.id, count: count || 0 };
    });

    // Get all private room members in one query
    const privateRoomIds = rooms.filter(r => r.type === "private").map(r => r.id);
    const { data: allPrivateMembers } = privateRoomIds.length > 0
      ? await supabase
          .from("chat_room_members")
          .select(`
            room_id,
            user_id,
            users:user_id (
              id,
              full_name,
              email,
              avatar_url
            )
          `)
          .in("room_id", privateRoomIds)
          .neq("user_id", user.id)
      : { data: [] };

    // Create a map of room_id -> other user for private rooms
    const otherUserByRoom: Record<string, unknown> = {};
    for (const member of allPrivateMembers || []) {
      otherUserByRoom[member.room_id] = member.users;
    }

    // Wait for unread counts
    const unreadCounts = await Promise.all(unreadCountsPromises);
    const unreadCountByRoom: Record<string, number> = {};
    for (const { roomId, count } of unreadCounts) {
      unreadCountByRoom[roomId] = count;
    }

    // Combine all data
    const roomsWithMeta = rooms.map((room) => ({
      ...room,
      last_message: lastMessageByRoom[room.id] || null,
      unread_count: unreadCountByRoom[room.id] || 0,
      other_user: otherUserByRoom[room.id] || null
    }));

    // Sort by last message time
    roomsWithMeta.sort((a, b) => {
      const aTime = a.last_message?.created_at || a.created_at;
      const bTime = b.last_message?.created_at || b.created_at;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    return NextResponse.json({ rooms: roomsWithMeta });
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    return NextResponse.json({ error: "Failed to fetch rooms" }, { status: 500 });
  }
}

// POST /api/chat/rooms - Create a new room or get existing DM
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, name, description, participant_id } = body;

    // For private DMs, check if conversation already exists
    if (type === "private" && participant_id) {
      // Find existing DM between these two users
      const { data: existingRooms } = await supabase
        .from("chat_room_members")
        .select("room_id")
        .eq("user_id", user.id);

      if (existingRooms) {
        for (const { room_id } of existingRooms) {
          const { data: room } = await supabase
            .from("chat_rooms")
            .select("*")
            .eq("id", room_id)
            .eq("type", "private")
            .single();

          if (room) {
            const { data: otherMember } = await supabase
              .from("chat_room_members")
              .select("user_id")
              .eq("room_id", room_id)
              .eq("user_id", participant_id)
              .single();

            if (otherMember) {
              // Return existing room
              return NextResponse.json({ room, existing: true });
            }
          }
        }
      }

      // Create new private room
      const { data: newRoom, error: roomError } = await supabase
        .from("chat_rooms")
        .insert({
          type: "private",
          created_by: user.id
        })
        .select()
        .single();

      if (roomError) throw roomError;

      // Add both users as members
      const { error: membersError } = await supabase
        .from("chat_room_members")
        .insert([
          { room_id: newRoom.id, user_id: user.id },
          { room_id: newRoom.id, user_id: participant_id }
        ]);

      if (membersError) throw membersError;

      return NextResponse.json({ room: newRoom, existing: false });
    }

    // Create group or community room
    const { data: newRoom, error: roomError } = await supabase
      .from("chat_rooms")
      .insert({
        name,
        type: type || "group",
        description,
        created_by: user.id
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // Add creator as admin member
    const { error: memberError } = await supabase
      .from("chat_room_members")
      .insert({
        room_id: newRoom.id,
        user_id: user.id,
        role: "admin"
      });

    if (memberError) throw memberError;

    return NextResponse.json({ room: newRoom });
  } catch (error) {
    console.error("Error creating chat room:", error);
    return NextResponse.json({ error: "Failed to create room" }, { status: 500 });
  }
}
