import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const days = parseInt(searchParams.get("days") || "30");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  try {
    // Fetch all the data we need in parallel
    const [
      tasksResult,
      completedTasksResult,
      clientsResult,
      activeClientsResult,
      activityResult,
    ] = await Promise.all([
      // Total tasks in period
      supabase
        .from("tasks")
        .select("id, status, priority, created_at, completed_at", { count: "exact" })
        .gte("created_at", startDateStr),

      // Completed tasks in period
      supabase
        .from("tasks")
        .select("id, completed_at", { count: "exact" })
        .eq("status", "completed")
        .gte("completed_at", startDateStr),

      // Total clients
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true }),

      // Active clients
      supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),

      // Activity for calls and documents
      supabase
        .from("activity_log")
        .select("id, action, resource_type, created_at")
        .gte("created_at", startDateStr),
    ]);

    const tasks = tasksResult.data || [];
    const completedTasks = completedTasksResult.data || [];
    const totalClients = clientsResult.count || 0;
    const activeClients = activeClientsResult.count || 0;
    const activities = activityResult.data || [];

    // Calculate task completion rate
    const totalTasks = tasks.length;
    const completedCount = completedTasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    // Count calls and documents from activity
    const callsHandled = activities.filter(a => a.resource_type === "call").length;
    const documentsProcessed = activities.filter(a => a.resource_type === "document").length;

    // Task distribution by status
    const taskDistribution = [
      { name: "Pending", value: tasks.filter(t => t.status === "pending").length, color: "#FCD34D" },
      { name: "In Progress", value: tasks.filter(t => t.status === "in_progress").length, color: "#60A5FA" },
      { name: "Completed", value: tasks.filter(t => t.status === "completed").length, color: "#34D399" },
    ].filter(item => item.value > 0);

    // Client status distribution
    const clientDistribution = [
      { name: "Active", value: activeClients, color: "#34D399" },
      { name: "Inactive", value: totalClients - activeClients, color: "#9CA3AF" },
    ].filter(item => item.value > 0);

    // Weekly task completion data (last 7 days for chart)
    const weeklyData = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Count tasks completed on this day
      const dayCompleted = completedTasks.filter(t => {
        const completedAt = new Date(t.completed_at);
        return completedAt >= date && completedAt < nextDate;
      }).length;

      // For "last week" comparison, get data from 7 days earlier
      const lastWeekDate = new Date(date);
      lastWeekDate.setDate(lastWeekDate.getDate() - 7);
      const lastWeekNextDate = new Date(nextDate);
      lastWeekNextDate.setDate(lastWeekNextDate.getDate() - 7);

      weeklyData.push({
        day: dayNames[date.getDay()],
        thisWeek: dayCompleted,
        lastWeek: 0, // Would need historical data for accurate comparison
      });
    }

    return NextResponse.json({
      metrics: {
        totalTasks,
        completedTasks: completedCount,
        completionRate,
        totalClients,
        activeClients,
        callsHandled,
        documentsProcessed,
      },
      taskDistribution,
      clientDistribution,
      weeklyData,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
