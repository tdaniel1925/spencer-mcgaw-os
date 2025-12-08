import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/chat/messages?room_id=xxx&limit=50&before=xxx
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("room_id");
  const limit = parseInt(searchParams.get("limit") || "50");
  const before = searchParams.get("before");

  if (!roomId) {
    return NextResponse.json({ error: "room_id is required" }, { status: 400 });
  }

  try {
    // Verify user has access to this room
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("type")
      .eq("id", roomId)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.type !== "community") {
      const { data: membership } = await supabase
        .from("chat_room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
      }
    }

    // Fetch messages
    let query = supabase
      .from("chat_messages")
      .select(`
        id,
        room_id,
        user_id,
        content,
        message_type,
        reply_to,
        is_edited,
        is_deleted,
        created_at,
        updated_at,
        metadata,
        users:user_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("room_id", roomId)
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: messages, error } = await query;

    if (error) throw error;

    // Update last_read_at for this user
    await supabase
      .from("chat_room_members")
      .upsert({
        room_id: roomId,
        user_id: user.id,
        last_read_at: new Date().toISOString()
      }, {
        onConflict: "room_id,user_id"
      });

    // Return messages in chronological order
    return NextResponse.json({
      messages: (messages || []).reverse(),
      has_more: messages?.length === limit
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

// POST /api/chat/messages - Send a message
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { room_id, content, reply_to } = body;

    if (!room_id || !content?.trim()) {
      return NextResponse.json({ error: "room_id and content are required" }, { status: 400 });
    }

    // Verify user has access to this room
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("type")
      .eq("id", room_id)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    // For community rooms, auto-join if not a member
    if (room.type === "community") {
      await supabase
        .from("chat_room_members")
        .upsert({
          room_id,
          user_id: user.id,
          last_read_at: new Date().toISOString()
        }, {
          onConflict: "room_id,user_id"
        });
    } else {
      const { data: membership } = await supabase
        .from("chat_room_members")
        .select("id")
        .eq("room_id", room_id)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
      }
    }

    // Create the message
    const { data: message, error } = await supabase
      .from("chat_messages")
      .insert({
        room_id,
        user_id: user.id,
        content: content.trim(),
        reply_to: reply_to || null
      })
      .select(`
        id,
        room_id,
        user_id,
        content,
        message_type,
        reply_to,
        is_edited,
        is_deleted,
        created_at,
        updated_at,
        users:user_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    // Clear typing indicator
    await supabase
      .from("chat_typing_indicators")
      .delete()
      .eq("room_id", room_id)
      .eq("user_id", user.id);

    // Update last_read_at
    await supabase
      .from("chat_room_members")
      .update({ last_read_at: new Date().toISOString() })
      .eq("room_id", room_id)
      .eq("user_id", user.id);

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
