import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tasks/[id]/subtasks/[subtaskId]
 * Get a single subtask
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const { id: taskId, subtaskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: subtask, error } = await supabase
    .from("subtasks")
    .select("*")
    .eq("id", subtaskId)
    .eq("task_id", taskId)
    .single();

  if (error) {
    console.error("[Subtasks API] Error fetching subtask:", error);
    return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
  }

  return NextResponse.json({ subtask });
}

/**
 * PUT /api/tasks/[id]/subtasks/[subtaskId]
 * Update a subtask (including toggle completion)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const { id: taskId, subtaskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, is_completed, due_date, position } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (due_date !== undefined) updates.due_date = due_date;
    if (position !== undefined) updates.position = position;

    // Handle completion toggle
    if (is_completed !== undefined) {
      updates.is_completed = is_completed;
      if (is_completed) {
        updates.completed_at = new Date().toISOString();
        updates.completed_by = user.id;
      } else {
        updates.completed_at = null;
        updates.completed_by = null;
      }
    }

    // Get old values for logging
    const { data: oldSubtask } = await supabase
      .from("subtasks")
      .select("*")
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .single();

    if (!oldSubtask) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    const { data: subtask, error } = await supabase
      .from("subtasks")
      .update(updates)
      .eq("id", subtaskId)
      .eq("task_id", taskId)
      .select()
      .single();

    if (error) {
      console.error("[Subtasks API] Error updating subtask:", error);
      return NextResponse.json({ error: "Failed to update subtask" }, { status: 500 });
    }

    // Log activity for completion changes
    if (is_completed !== undefined && is_completed !== oldSubtask.is_completed) {
      await supabase.from("task_activity").insert({
        task_id: taskId,
        user_id: user.id,
        action: is_completed ? "subtask_completed" : "subtask_uncompleted",
        description: is_completed
          ? `Completed subtask: ${subtask.title}`
          : `Uncompleted subtask: ${subtask.title}`,
        old_value: { is_completed: oldSubtask.is_completed },
        new_value: { is_completed, subtask_id: subtaskId },
      });
    }

    return NextResponse.json({ subtask });
  } catch (error) {
    console.error("[Subtasks API] Error updating subtask:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * DELETE /api/tasks/[id]/subtasks/[subtaskId]
 * Delete a subtask
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; subtaskId: string }> }
) {
  const { id: taskId, subtaskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get subtask for logging
  const { data: subtask } = await supabase
    .from("subtasks")
    .select("title")
    .eq("id", subtaskId)
    .eq("task_id", taskId)
    .single();

  const { error } = await supabase
    .from("subtasks")
    .delete()
    .eq("id", subtaskId)
    .eq("task_id", taskId);

  if (error) {
    console.error("[Subtasks API] Error deleting subtask:", error);
    return NextResponse.json({ error: "Failed to delete subtask" }, { status: 500 });
  }

  // Log activity
  if (subtask) {
    await supabase.from("task_activity").insert({
      task_id: taskId,
      user_id: user.id,
      action: "subtask_deleted",
      description: `Deleted subtask: ${subtask.title}`,
      old_value: { subtask_id: subtaskId, title: subtask.title },
    });
  }

  return NextResponse.json({ success: true });
}
