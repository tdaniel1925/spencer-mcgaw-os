import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/chat/search - Search messages
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q");
  const roomId = request.nextUrl.searchParams.get("room_id");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "50");
  const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

  if (!query || query.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  try {
    // Get rooms user has access to
    const { data: memberRooms } = await supabase
      .from("chat_room_members")
      .select("room_id")
      .eq("user_id", user.id);

    const { data: communityRooms } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("type", "community")
      .eq("is_archived", false);

    const accessibleRoomIds = [
      ...(memberRooms?.map(m => m.room_id) || []),
      ...(communityRooms?.map(r => r.id) || [])
    ];

    if (accessibleRoomIds.length === 0) {
      return NextResponse.json({ messages: [], total: 0 });
    }

    // Build the search query
    let searchQuery = supabase
      .from("chat_messages")
      .select(`
        *,
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
      `, { count: "exact" })
      .in("room_id", accessibleRoomIds)
      .eq("is_deleted", false)
      .ilike("content", `%${query}%`)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by specific room if provided
    if (roomId) {
      if (!accessibleRoomIds.includes(roomId)) {
        return NextResponse.json({ error: "Room not accessible" }, { status: 403 });
      }
      searchQuery = searchQuery.eq("room_id", roomId);
    }

    const { data: messages, error, count } = await searchQuery;

    if (error) throw error;

    return NextResponse.json({
      messages: messages || [],
      total: count || 0,
      query,
      limit,
      offset
    });
  } catch (error) {
    console.error("Error searching messages:", error);
    return NextResponse.json({ error: "Failed to search messages" }, { status: 500 });
  }
}
