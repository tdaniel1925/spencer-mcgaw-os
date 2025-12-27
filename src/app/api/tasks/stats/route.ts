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

  // Fetch ALL stats in parallel (including urgent tasks) for faster loading
  const [
    totalResult,
    pendingResult,
    inProgressResult,
    completedResult,
    completedTodayResult,
    completedThisWeekResult,
    dueTodayResult,
    overdueResult,
    urgentTasksResult,
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
      .neq("status", "cancelled")
      .gte("due_date", today.toISOString())
      .lt("due_date", tomorrow.toISOString()),
    supabase.from("tasks").select("id", { count: "exact", head: true })
      .neq("status", "completed")
      .neq("status", "cancelled")
      .lt("due_date", today.toISOString()),
    // Urgent tasks - included in parallel
    supabase
      .from("tasks")
      .select("id, title, due_date, priority")
      .or("priority.eq.urgent,priority.eq.high")
      .neq("status", "completed")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(5),
  ]);

  return NextResponse.json({
    total: totalResult.count || 0,
    pending: pendingResult.count || 0,
    inProgress: inProgressResult.count || 0,
    completed: completedResult.count || 0,
    completedToday: completedTodayResult.count || 0,
    completedThisWeek: completedThisWeekResult.count || 0,
    dueToday: dueTodayResult.count || 0,
    overdue: overdueResult.count || 0,
    urgentTasks: urgentTasksResult.data || [],
  });
}
