import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export type PresenceStatus = "online" | "away" | "busy" | "offline";

export interface UserPresence {
  user_id: string;
  status: PresenceStatus;
  last_seen_at: string;
  current_room_id?: string;
  user_profiles?: {
    full_name: string;
    email: string;
    avatar_url?: string;
  };
}

// GET /api/chat/presence - Get presence for all users or specific users
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const userIds = request.nextUrl.searchParams.get("user_ids");

    let query = supabase
      .from("user_presence")
      .select(`
        user_id,
        status,
        last_seen_at,
        current_room_id,
        user_profiles:user_id (
          full_name,
          email,
          avatar_url
        )
      `);

    if (userIds) {
      const ids = userIds.split(",");
      query = query.in("user_id", ids);
    }

    const { data: presence, error } = await query;

    if (error) throw error;

    return NextResponse.json({ presence: presence || [] });
  } catch (error) {
    console.error("Error fetching presence:", error);
    return NextResponse.json({ error: "Failed to fetch presence" }, { status: 500 });
  }
}

// POST /api/chat/presence - Update own presence
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { status, current_room_id } = body as {
      status?: PresenceStatus;
      current_room_id?: string | null;
    };

    // Upsert presence record
    const { data, error } = await supabase
      .from("user_presence")
      .upsert({
        user_id: user.id,
        status: status || "online",
        current_room_id: current_room_id || null,
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ presence: data });
  } catch (error) {
    console.error("Error updating presence:", error);
    return NextResponse.json({ error: "Failed to update presence" }, { status: 500 });
  }
}

// DELETE /api/chat/presence - Set offline (for logout/close)
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("user_presence")
      .upsert({
        user_id: user.id,
        status: "offline",
        last_seen_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id"
      });

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error setting offline:", error);
    return NextResponse.json({ error: "Failed to set offline" }, { status: 500 });
  }
}
