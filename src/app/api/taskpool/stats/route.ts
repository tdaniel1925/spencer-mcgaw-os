import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get TaskPool statistics
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const today = new Date().toISOString().split("T")[0];

    // Get counts by status
    const { count: openCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "open");

    const { count: inProgressCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "in_progress");

    const { count: completedCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    // Get unclaimed count (pool tasks)
    const { count: poolCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .is("claimed_by", null)
      .eq("status", "open");

    // Get my claimed count
    const { count: myClaimedCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("claimed_by", user.id)
      .neq("status", "completed");

    // Get overdue count
    const { count: overdueCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .lt("due_date", today)
      .neq("status", "completed");

    // Get counts by action type
    const { data: actionTypes } = await supabase
      .from("task_action_types")
      .select("id, code, label, color")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    const actionTypeCounts: Record<string, number> = {};
    if (actionTypes) {
      for (const actionType of actionTypes) {
        const { count } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("action_type_id", actionType.id)
          .eq("status", "open")
          .is("claimed_by", null);

        actionTypeCounts[actionType.code] = count || 0;
      }
    }

    // Get counts by priority
    const { count: urgentCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("priority", "urgent")
      .neq("status", "completed");

    const { count: highCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("priority", "high")
      .neq("status", "completed");

    // Get AI-created tasks count
    const { count: aiTasksCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("source_type", "email");

    // Get tasks completed today
    const { count: completedTodayCount } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("completed_at", `${today}T00:00:00`)
      .lte("completed_at", `${today}T23:59:59`);

    return NextResponse.json({
      totals: {
        open: openCount || 0,
        in_progress: inProgressCount || 0,
        completed: completedCount || 0,
        total: (openCount || 0) + (inProgressCount || 0) + (completedCount || 0),
      },
      pool: {
        available: poolCount || 0,
        my_claimed: myClaimedCount || 0,
        overdue: overdueCount || 0,
      },
      by_action_type: actionTypeCounts,
      by_priority: {
        urgent: urgentCount || 0,
        high: highCount || 0,
      },
      ai: {
        total_extracted: aiTasksCount || 0,
      },
      today: {
        completed: completedTodayCount || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching TaskPool stats:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
