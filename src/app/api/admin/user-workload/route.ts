import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface UserWorkload {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  department: string | null;
  stats: {
    total_assigned: number;
    pending: number;
    in_progress: number;
    completed_today: number;
    completed_this_week: number;
    overdue: number;
    avg_completion_time_minutes: number;
    completion_rate: number;
  };
  privacy_hidden: boolean;
  recent_tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    created_at: string;
  }>;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  try {
    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: currentUser } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!currentUser || !["owner", "admin", "manager"].includes(currentUser.role)) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Get query params
    const { searchParams } = new URL(request.url);
    const filterRole = searchParams.get("role");
    const filterDepartment = searchParams.get("department");
    const sortBy = searchParams.get("sort") || "workload";

    // Get all active users
    let usersQuery = supabase
      .from("user_profiles")
      .select("id, full_name, email, avatar_url, role, department")
      .eq("is_active", true);

    if (filterRole && filterRole !== "all") {
      usersQuery = usersQuery.eq("role", filterRole);
    }
    if (filterDepartment && filterDepartment !== "all") {
      usersQuery = usersQuery.eq("department", filterDepartment);
    }

    const { data: users, error: usersError } = await usersQuery;

    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    if (!users || users.length === 0) {
      return NextResponse.json({
        workloads: [],
        summary: {
          total_users: 0,
          total_tasks: 0,
          total_pending: 0,
          total_overdue: 0,
          avg_tasks_per_user: 0,
          busiest_user: null,
          least_busy_user: null,
        },
      });
    }

    // Get task stats for all users
    const userIds = users.map((u) => u.id);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get all tasks for these users
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, priority, assigned_to, created_at, completed_at, due_date")
      .in("assigned_to", userIds);

    // Get privacy settings
    const { data: privacySettings } = await supabase
      .from("user_privacy_settings")
      .select("user_id, hide_performance_from_peers")
      .in("user_id", userIds);

    const privacyMap = new Map(
      (privacySettings || []).map((p) => [p.user_id, p.hide_performance_from_peers])
    );

    // Calculate stats per user
    const workloads: UserWorkload[] = users.map((userProfile) => {
      const userTasks = (tasks || []).filter((t) => t.assigned_to === userProfile.id);

      const pending = userTasks.filter((t) => t.status === "pending" || t.status === "open").length;
      const inProgress = userTasks.filter((t) => t.status === "in_progress").length;
      const completed = userTasks.filter((t) => t.status === "completed");
      const completedToday = completed.filter((t) => t.completed_at && t.completed_at >= todayStart).length;
      const completedThisWeek = completed.filter((t) => t.completed_at && t.completed_at >= weekStart).length;

      // Count overdue tasks
      const overdue = userTasks.filter((t) => {
        if (t.status === "completed" || t.status === "cancelled") return false;
        if (!t.due_date) return false;
        return new Date(t.due_date) < now;
      }).length;

      // Calculate average completion time
      let avgTime = 0;
      const completedWithTime = completed.filter((t) => t.completed_at && t.created_at);
      if (completedWithTime.length > 0) {
        const times = completedWithTime.map((t) => {
          const created = new Date(t.created_at);
          const completedAt = new Date(t.completed_at!);
          return (completedAt.getTime() - created.getTime()) / (1000 * 60);
        });
        avgTime = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
      }

      // Calculate completion rate
      const totalActioned = completed.length + userTasks.filter((t) => t.status === "cancelled").length;
      const completionRate = totalActioned > 0 ? Math.round((completed.length / totalActioned) * 100) : 0;

      // Get recent tasks
      const recentTasks = userTasks
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          created_at: t.created_at,
        }));

      return {
        id: userProfile.id,
        full_name: userProfile.full_name,
        email: userProfile.email,
        avatar_url: userProfile.avatar_url,
        role: userProfile.role,
        department: userProfile.department,
        stats: {
          total_assigned: userTasks.length,
          pending,
          in_progress: inProgress,
          completed_today: completedToday,
          completed_this_week: completedThisWeek,
          overdue,
          avg_completion_time_minutes: avgTime,
          completion_rate: completionRate,
        },
        privacy_hidden: privacyMap.get(userProfile.id) || false,
        recent_tasks: recentTasks,
      };
    });

    // Sort workloads
    switch (sortBy) {
      case "workload":
        workloads.sort((a, b) =>
          (b.stats.pending + b.stats.in_progress) - (a.stats.pending + a.stats.in_progress)
        );
        break;
      case "overdue":
        workloads.sort((a, b) => b.stats.overdue - a.stats.overdue);
        break;
      case "completion":
        workloads.sort((a, b) => b.stats.completion_rate - a.stats.completion_rate);
        break;
      case "name":
        workloads.sort((a, b) => a.full_name.localeCompare(b.full_name));
        break;
    }

    // Calculate summary
    const summary = {
      total_users: workloads.length,
      total_tasks: workloads.reduce((sum, w) => sum + w.stats.total_assigned, 0),
      total_pending: workloads.reduce((sum, w) => sum + w.stats.pending + w.stats.in_progress, 0),
      total_overdue: workloads.reduce((sum, w) => sum + w.stats.overdue, 0),
      avg_tasks_per_user: workloads.length > 0
        ? workloads.reduce((sum, w) => sum + w.stats.total_assigned, 0) / workloads.length
        : 0,
      busiest_user: workloads.length > 0
        ? {
            name: workloads.reduce((max, w) =>
              (w.stats.pending + w.stats.in_progress) > (max.stats.pending + max.stats.in_progress) ? w : max
            ).full_name,
            count: workloads.reduce((max, w) =>
              Math.max(max, w.stats.pending + w.stats.in_progress), 0
            ),
          }
        : null,
      least_busy_user: workloads.length > 0
        ? {
            name: workloads.reduce((min, w) =>
              (w.stats.pending + w.stats.in_progress) < (min.stats.pending + min.stats.in_progress) ? w : min
            ).full_name,
            count: workloads.reduce((min, w) =>
              Math.min(min, w.stats.pending + w.stats.in_progress), Infinity
            ),
          }
        : null,
    };

    return NextResponse.json({ workloads, summary });
  } catch (error) {
    console.error("Error in user workload API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
