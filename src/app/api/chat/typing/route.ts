import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/chat/typing - Set typing indicator
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { room_id, is_typing } = body;

    if (!room_id) {
      return NextResponse.json({ error: "room_id is required" }, { status: 400 });
    }

    if (is_typing) {
      // Upsert typing indicator
      const { error } = await supabase
        .from("chat_typing_indicators")
        .upsert({
          room_id,
          user_id: user.id,
          started_at: new Date().toISOString()
        }, {
          onConflict: "room_id,user_id"
        });

      if (error) throw error;
    } else {
      // Remove typing indicator
      const { error } = await supabase
        .from("chat_typing_indicators")
        .delete()
        .eq("room_id", room_id)
        .eq("user_id", user.id);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating typing indicator:", error);
    return NextResponse.json({ error: "Failed to update typing indicator" }, { status: 500 });
  }
}

// GET /api/chat/typing?room_id=xxx - Get who's typing in a room
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("room_id");

  if (!roomId) {
    return NextResponse.json({ error: "room_id is required" }, { status: 400 });
  }

  try {
    // Get typing indicators that are less than 5 seconds old
    const fiveSecondsAgo = new Date(Date.now() - 5000).toISOString();

    const { data: typing, error } = await supabase
      .from("chat_typing_indicators")
      .select(`
        user_id,
        started_at,
        profiles:user_id (
          id,
          full_name,
          email
        )
      `)
      .eq("room_id", roomId)
      .neq("user_id", user.id)
      .gt("started_at", fiveSecondsAgo);

    if (error) throw error;

    return NextResponse.json({
      typing: typing?.map(t => ({
        user_id: t.user_id,
        user: t.profiles
      })) || []
    });
  } catch (error) {
    console.error("Error fetching typing indicators:", error);
    return NextResponse.json({ error: "Failed to fetch typing indicators" }, { status: 500 });
  }
}
