import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/chat/mentions - Get unread mentions for current user
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const unreadOnly = request.nextUrl.searchParams.get("unread") !== "false";

  try {
    let query = supabase
      .from("chat_mentions")
      .select(`
        *,
        message:message_id (
          id,
          content,
          room_id,
          created_at,
          users:user_id (
            id,
            full_name,
            email,
            avatar_url
          ),
          chat_rooms:room_id (
            id,
            name,
            type
          )
        )
      `)
      .eq("mentioned_user_id", user.id)
      .order("created_at", { ascending: false });

    if (unreadOnly) {
      query = query.eq("is_read", false);
    }

    const { data: mentions, error } = await query.limit(50);

    if (error) throw error;

    return NextResponse.json({ mentions: mentions || [] });
  } catch (error) {
    console.error("Error fetching mentions:", error);
    return NextResponse.json({ error: "Failed to fetch mentions" }, { status: 500 });
  }
}

// POST /api/chat/mentions - Mark mentions as read
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { mention_ids, room_id, mark_all } = body;

    if (mark_all) {
      // Mark all mentions as read
      const { error } = await supabase
        .from("chat_mentions")
        .update({ is_read: true })
        .eq("mentioned_user_id", user.id)
        .eq("is_read", false);

      if (error) throw error;
    } else if (room_id) {
      // Mark all mentions in a room as read
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("room_id", room_id);

      if (messages && messages.length > 0) {
        const messageIds = messages.map(m => m.id);
        const { error } = await supabase
          .from("chat_mentions")
          .update({ is_read: true })
          .eq("mentioned_user_id", user.id)
          .in("message_id", messageIds);

        if (error) throw error;
      }
    } else if (mention_ids && mention_ids.length > 0) {
      // Mark specific mentions as read
      const { error } = await supabase
        .from("chat_mentions")
        .update({ is_read: true })
        .eq("mentioned_user_id", user.id)
        .in("id", mention_ids);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error marking mentions as read:", error);
    return NextResponse.json({ error: "Failed to update mentions" }, { status: 500 });
  }
}
