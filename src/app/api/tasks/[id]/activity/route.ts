import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface TaskActivity {
  id: string;
  task_id: string;
  user_id: string | null;
  action: string;
  description: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  } | null;
}

/**
 * GET /api/tasks/[id]/activity
 * Get activity feed for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: activity, error, count } = await supabase
    .from("task_activity")
    .select(`
      *,
      user:user_profiles!task_activity_user_id_fkey(id, full_name, avatar_url)
    `, { count: "exact" })
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[Task Activity API] Error fetching activity:", error);
    // If the error is about the foreign key, try without the join
    const { data: activityWithoutUser, error: simpleError } = await supabase
      .from("task_activity")
      .select("*", { count: "exact" })
      .eq("task_id", taskId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (simpleError) {
      return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
    }

    return NextResponse.json({
      activity: activityWithoutUser || [],
      count: activityWithoutUser?.length || 0,
    });
  }

  return NextResponse.json({
    activity: activity || [],
    count: count || 0,
  });
}

/**
 * POST /api/tasks/[id]/activity
 * Add a comment or note to task activity
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, description, metadata } = body;

    if (!description) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const { data: activity, error } = await supabase
      .from("task_activity")
      .insert({
        task_id: taskId,
        user_id: user.id,
        action: action || "comment",
        description,
        metadata: metadata || null,
      })
      .select()
      .single();

    if (error) {
      console.error("[Task Activity API] Error creating activity:", error);
      return NextResponse.json({ error: "Failed to create activity" }, { status: 500 });
    }

    return NextResponse.json({ activity }, { status: 201 });
  } catch (error) {
    console.error("[Task Activity API] Error creating activity:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
