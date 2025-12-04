import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get this week's date range
  const startOfWeek = new Date(today);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 7);

  // Fetch all stats in parallel
  const [
    totalResult,
    pendingResult,
    inProgressResult,
    completedResult,
    completedTodayResult,
    completedThisWeekResult,
    dueTodayResult,
    overdueResult,
  ] = await Promise.all([
    supabase.from("tasks").select("id", { count: "exact", head: true }),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
    supabase.from("tasks").select("id", { count: "exact", head: true }).eq("status", "completed"),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", today.toISOString())
      .lt("completed_at", tomorrow.toISOString()),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", startOfWeek.toISOString())
      .lt("completed_at", endOfWeek.toISOString()),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .neq("status", "completed")
      .gte("due_date", today.toISOString())
      .lt("due_date", tomorrow.toISOString()),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .neq("status", "completed")
      .lt("due_date", today.toISOString()),
  ]);

  // Get urgent tasks (high priority, not completed)
  const { data: urgentTasks } = await supabase
    .from("tasks")
    .select("id, title, due_date, priority, client_name")
    .eq("priority", "high")
    .neq("status", "completed")
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(5);

  // Get recent activity
  const { data: recentActivity } = await supabase
    .from("activity_log")
    .select("*")
    .eq("resource_type", "task")
    .order("created_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    total: totalResult.count || 0,
    pending: pendingResult.count || 0,
    inProgress: inProgressResult.count || 0,
    completed: completedResult.count || 0,
    completedToday: completedTodayResult.count || 0,
    completedThisWeek: completedThisWeekResult.count || 0,
    dueToday: dueTodayResult.count || 0,
    overdue: overdueResult.count || 0,
    urgentTasks: urgentTasks || [],
    recentActivity: recentActivity || [],
  });
}
