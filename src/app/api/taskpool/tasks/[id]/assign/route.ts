import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAITaskFeedback } from "@/lib/ai/task-learning";
import { notifyTaskAssigned } from "@/lib/notifications/notification-service";
import { hasPermissionWithOverrides, type Permission, type PermissionOverride } from "@/lib/permissions";

// Helper to check user permission with overrides
async function checkPermission(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  permission: Permission
): Promise<boolean> {
  // Get user role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (!profile?.role) return false;

  // Get permission overrides
  const { data: overrides } = await supabase
    .from("user_permission_overrides")
    .select("*")
    .eq("user_id", userId);

  return hasPermissionWithOverrides(
    profile.role,
    permission,
    (overrides || []) as PermissionOverride[]
  );
}

// POST - Assign a task to a user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { assigned_to } = body;

    if (!assigned_to) {
      return NextResponse.json(
        { error: "assigned_to is required" },
        { status: 400 }
      );
    }

    // Check if user has tasks:assign permission
    const canAssign = await checkPermission(supabase, user.id, "tasks:assign");
    if (!canAssign) {
      return NextResponse.json(
        { error: "You don't have permission to assign tasks" },
        { status: 403 }
      );
    }

    // Check if task exists
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id, title, assigned_to, claimed_by")
      .eq("id", id)
      .single();

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Assign the task
    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        assigned_to,
        assigned_at: new Date().toISOString(),
        assigned_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        action_type:task_action_types!tasks_action_type_id_fkey(*),
        client:client_contacts(id, first_name, last_name, email, phone)
      `)
      .single();

    if (error) {
      console.error("Error assigning task:", error);
      return NextResponse.json({ error: "Failed to assign task" }, { status: 500 });
    }

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: id,
      action: "assigned",
      details: { assigned_to, assigned_by: user.id },
      performed_by: user.id,
    });

    // Log AI learning feedback for assignment patterns (runs async)
    logAITaskFeedback({
      taskId: id,
      action: "assigned",
      userId: user.id,
      details: {
        assignedTo: assigned_to,
      },
    }).catch(err => console.error("[AI Learning] Error:", err));

    // Send notification to assignee (runs async)
    notifyTaskAssigned(
      id,
      task.title,
      assigned_to,
      user.id,
      task.client_id
    ).catch(err => console.error("[Notifications] Error:", err));

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error assigning task:", error);
    return NextResponse.json({ error: "Failed to assign task" }, { status: 500 });
  }
}

// DELETE - Unassign a task
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Check if user has tasks:assign permission (same permission for assign/unassign)
    const canUnassign = await checkPermission(supabase, user.id, "tasks:assign");
    if (!canUnassign) {
      return NextResponse.json(
        { error: "You don't have permission to unassign tasks" },
        { status: 403 }
      );
    }

    // Get current task to capture previous assignee for audit
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id, assigned_to")
      .eq("id", id)
      .single();

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Unassign the task
    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        assigned_to: null,
        assigned_at: null,
        assigned_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(`
        *,
        action_type:task_action_types!tasks_action_type_id_fkey(*),
        client:client_contacts(id, first_name, last_name, email, phone)
      `)
      .single();

    if (error) {
      console.error("Error unassigning task:", error);
      return NextResponse.json({ error: "Failed to unassign task" }, { status: 500 });
    }

    // Log activity with previous assignee for audit trail
    await supabase.from("task_activity_log").insert({
      task_id: id,
      action: "unassigned",
      details: {
        unassigned_by: user.id,
        previous_assignee: existingTask.assigned_to
      },
      performed_by: user.id,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error unassigning task:", error);
    return NextResponse.json({ error: "Failed to unassign task" }, { status: 500 });
  }
}
