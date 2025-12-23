import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/admin/team-overview
 *
 * Returns team members with their task counts and online status.
 * Admin only endpoint.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Check if user is admin
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Get all team members
    const { data: users, error: usersError } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, role")
      .eq("is_active", true)
      .order("full_name");

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json({ error: "Failed to fetch team" }, { status: 500 });
    }

    // Get task counts per user
    const { data: taskCounts } = await supabase
      .from("tasks")
      .select("assigned_to, status")
      .neq("status", "completed");

    // Get presence status
    const { data: presence } = await supabase
      .from("user_presence")
      .select("user_id, status, last_seen_at");

    // Build presence map
    const presenceMap = new Map(
      (presence || []).map(p => [p.user_id, p])
    );

    // Count tasks per user
    const taskCountMap = new Map<string, number>();
    for (const task of taskCounts || []) {
      if (task.assigned_to) {
        taskCountMap.set(task.assigned_to, (taskCountMap.get(task.assigned_to) || 0) + 1);
      }
    }

    // Get completed tasks today per user
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: completedToday } = await supabase
      .from("tasks")
      .select("completed_by")
      .eq("status", "completed")
      .gte("completed_at", today.toISOString());

    const completedTodayMap = new Map<string, number>();
    for (const task of completedToday || []) {
      if (task.completed_by) {
        completedTodayMap.set(task.completed_by, (completedTodayMap.get(task.completed_by) || 0) + 1);
      }
    }

    // Build response
    const members = (users || []).map(u => {
      const userPresence = presenceMap.get(u.id);
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const isOnline = userPresence?.status === "online" &&
        userPresence?.last_seen_at &&
        new Date(userPresence.last_seen_at) > fiveMinutesAgo;

      return {
        id: u.id,
        name: u.full_name || u.email?.split("@")[0] || "Unknown",
        email: u.email,
        role: u.role || "staff",
        isOnline,
        taskCount: taskCountMap.get(u.id) || 0,
        completedToday: completedTodayMap.get(u.id) || 0,
      };
    });

    // Sort by task count descending, then by name
    members.sort((a, b) => {
      if (b.taskCount !== a.taskCount) return b.taskCount - a.taskCount;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ members });
  } catch (error) {
    console.error("Error fetching team overview:", error);
    return NextResponse.json({ error: "Failed to fetch team overview" }, { status: 500 });
  }
}
