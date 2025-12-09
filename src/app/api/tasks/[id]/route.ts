import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  return NextResponse.json({ task });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  console.log("[Tasks API] PUT request for task:", id);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log("[Tasks API] Not authenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    console.log("[Tasks API] Request body:", JSON.stringify(body));

    const {
      title,
      description,
      status,
      priority,
      due_date,
      client_id,
      // Support both old names and new database column names
      assignee_id,
      assigned_to,
      assignee_name,
    } = body;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) {
      updates.status = status;
      if (status === "completed") {
        updates.completed_at = new Date().toISOString();
      }
    }
    if (priority !== undefined) updates.priority = priority;
    if (due_date !== undefined) updates.due_date = due_date;
    if (client_id !== undefined) updates.client_id = client_id;

    // Map assignee_id to assigned_to (database column name)
    const assigneeValue = assigned_to !== undefined ? assigned_to : assignee_id;
    if (assigneeValue !== undefined) {
      updates.assigned_to = assigneeValue;
      // If assigning, also set assigned_at and assigned_by
      if (assigneeValue) {
        updates.assigned_at = new Date().toISOString();
        updates.assigned_by = user.id;
      } else {
        updates.assigned_at = null;
        updates.assigned_by = null;
      }
    }

    console.log("[Tasks API] Updates to apply:", JSON.stringify(updates));

    const { data: task, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[Tasks API] Error updating task:", error);
      return NextResponse.json({ error: "Failed to update task", details: error.message }, { status: 500 });
    }

    console.log("[Tasks API] Task updated successfully:", task?.id, "assigned_to:", task?.assigned_to);

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: status === "completed" ? "completed" : "updated",
      resource_type: "task",
      resource_id: id,
      resource_name: task.title,
      details: { changes: Object.keys(updates).filter(k => k !== "updated_at") },
    });

    return NextResponse.json({ task, success: true });
  } catch (error) {
    console.error("[Tasks API] Error updating task:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get task details for logging
  const { data: task } = await supabase
    .from("tasks")
    .select("title")
    .eq("id", id)
    .single();

  const { error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }

  // Log activity
  await supabase.from("activity_log").insert({
    user_id: user.id,
    user_email: user.email,
    action: "deleted",
    resource_type: "task",
    resource_id: id,
    resource_name: task?.title || "Unknown task",
  });

  return NextResponse.json({ success: true });
}
