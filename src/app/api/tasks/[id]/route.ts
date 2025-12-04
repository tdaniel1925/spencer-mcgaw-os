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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      title,
      description,
      status,
      priority,
      due_date,
      client_id,
      client_name,
      assignee_id,
      assignee_name,
      tags,
      estimated_minutes,
      actual_minutes,
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
    if (client_name !== undefined) updates.client_name = client_name;
    if (assignee_id !== undefined) updates.assignee_id = assignee_id;
    if (assignee_name !== undefined) updates.assignee_name = assignee_name;
    if (tags !== undefined) updates.tags = tags;
    if (estimated_minutes !== undefined) updates.estimated_minutes = estimated_minutes;
    if (actual_minutes !== undefined) updates.actual_minutes = actual_minutes;

    const { data: task, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating task:", error);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

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

    return NextResponse.json({ task });
  } catch (error) {
    console.error("Error updating task:", error);
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
