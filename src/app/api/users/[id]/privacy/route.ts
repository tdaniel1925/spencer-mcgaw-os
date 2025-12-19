import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UserPrivacySettings, UpdatePrivacySettings } from "@/lib/types/permissions";

// GET - Get privacy settings for a user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can view privacy settings (self or admin)
    const { data: currentUser } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = currentUser?.role === "owner" || currentUser?.role === "admin";
    const isSelf = user.id === targetUserId;

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Get privacy settings
    const { data: settings, error } = await supabase
      .from("user_privacy_settings")
      .select("*")
      .eq("user_id", targetUserId)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "no rows returned" which is fine
      console.error("Error fetching privacy settings:", error);
      return NextResponse.json({ error: "Failed to fetch privacy settings" }, { status: 500 });
    }

    // Return default settings if none exist
    const defaultSettings: Omit<UserPrivacySettings, "id" | "updated_at"> = {
      user_id: targetUserId,
      hide_tasks_from_peers: false,
      hide_activity_from_peers: false,
      hide_performance_from_peers: false,
      hide_calendar_from_peers: false,
      visible_to_user_ids: [],
    };

    return NextResponse.json({
      settings: settings || { ...defaultSettings, id: null, updated_at: null },
    });
  } catch (error) {
    console.error("Error in GET /api/users/[id]/privacy:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update privacy settings
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Users can only update their own privacy settings
    if (user.id !== targetUserId) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body: UpdatePrivacySettings = await request.json();

    // Upsert privacy settings
    const { data: settings, error } = await supabase
      .from("user_privacy_settings")
      .upsert(
        {
          user_id: targetUserId,
          hide_tasks_from_peers: body.hide_tasks_from_peers ?? false,
          hide_activity_from_peers: body.hide_activity_from_peers ?? false,
          hide_performance_from_peers: body.hide_performance_from_peers ?? false,
          hide_calendar_from_peers: body.hide_calendar_from_peers ?? false,
          visible_to_user_ids: body.visible_to_user_ids ?? [],
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error updating privacy settings:", error);
      return NextResponse.json({ error: "Failed to update privacy settings" }, { status: 500 });
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error in PUT /api/users/[id]/privacy:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
