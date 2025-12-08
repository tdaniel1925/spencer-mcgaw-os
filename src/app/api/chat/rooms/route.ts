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

    // Get last message and unread count for each room
    const roomsWithMeta = await Promise.all(
      rooms.map(async (room) => {
        // Get last message
        const { data: lastMessage } = await supabase
          .from("chat_messages")
          .select(`
            id,
            content,
            created_at,
            user_id,
            profiles:user_id (
              full_name,
              email
            )
          `)
          .eq("room_id", room.id)
          .eq("is_deleted", false)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        // Get unread count
        const lastReadAt = room.last_read_at || new Date(0).toISOString();
        const { count: unreadCount } = await supabase
          .from("chat_messages")
          .select("id", { count: "exact", head: true })
          .eq("room_id", room.id)
          .eq("is_deleted", false)
          .neq("user_id", user.id)
          .gt("created_at", lastReadAt);

        // For private rooms, get the other participant's info
        let otherUser = null;
        if (room.type === "private") {
          const { data: members } = await supabase
            .from("chat_room_members")
            .select(`
              user_id,
              profiles:user_id (
                id,
                full_name,
                email,
                avatar_url
              )
            `)
            .eq("room_id", room.id)
            .neq("user_id", user.id)
            .single();

          otherUser = members?.profiles;
        }

        return {
          ...room,
          last_message: lastMessage,
          unread_count: unreadCount || 0,
          other_user: otherUser
        };
      })
    );

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
