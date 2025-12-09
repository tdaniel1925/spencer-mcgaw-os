import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get recent test events from activity log
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const since = searchParams.get("since"); // ISO timestamp

  try {
    let query = supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filter for test-related events
    query = query.or(
      "action.eq.test_task_created,action.eq.test_tasks_cleared,action.eq.task_assigned,action.eq.task_status_changed,action.eq.task_reassigned"
    );

    if (since) {
      query = query.gt("created_at", since);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Error fetching test events:", error);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    return NextResponse.json({ events: events || [] });
  } catch (error) {
    console.error("Error fetching test events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

// POST - Log a custom test event
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, resource_type, resource_id, resource_name, details } = body;

    if (!action) {
      return NextResponse.json({ error: "Action is required" }, { status: 400 });
    }

    const { data: event, error } = await supabase
      .from("activity_log")
      .insert({
        user_id: user.id,
        user_email: user.email,
        action,
        resource_type: resource_type || "task",
        resource_id: resource_id || null,
        resource_name: resource_name || null,
        details: { ...details, test_mode: true },
      })
      .select()
      .single();

    if (error) {
      console.error("Error logging event:", error);
      return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
    }

    return NextResponse.json({ event }, { status: 201 });
  } catch (error) {
    console.error("Error logging event:", error);
    return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
  }
}

// DELETE - Clear test-related events from activity log
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin or owner
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "owner"].includes(profile.role)) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  try {
    // Delete events where details contains test_mode: true
    const { data: deletedEvents, error } = await supabase
      .from("activity_log")
      .delete()
      .contains("details", { test_mode: true })
      .select("id");

    if (error) {
      console.error("Error clearing test events:", error);
      return NextResponse.json({ error: "Failed to clear test events" }, { status: 500 });
    }

    return NextResponse.json({
      message: `Cleared ${deletedEvents?.length || 0} test events`,
      deleted_count: deletedEvents?.length || 0
    });
  } catch (error) {
    console.error("Error clearing test events:", error);
    return NextResponse.json({ error: "Failed to clear test events" }, { status: 500 });
  }
}
