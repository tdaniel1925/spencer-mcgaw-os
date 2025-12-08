import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get single task with all details
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

  try {
    const { data: task, error } = await supabase
      .from("tasks")
      .select(`
        *,
        action_type:task_action_types!tasks_action_type_id_fkey(*),
        next_action_type:task_action_types!tasks_next_action_type_id_fkey(*),
        client:client_contacts(id, first_name, last_name, email, phone),
        notes:task_notes(*),
        activity:task_activity_log(*),
        attachments:task_attachments(*)
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching task:", error);
      return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
    }

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 });
  }
}

// PUT - Update task
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

    // Get current task for activity logging
    const { data: currentTask } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        ...body,
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
      console.error("Error updating task:", error);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    // Log activity
    const changes: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(body)) {
      if (currentTask && currentTask[key] !== body[key]) {
        changes[key] = { from: currentTask[key], to: body[key] };
      }
    }

    if (Object.keys(changes).length > 0) {
      await supabase.from("task_activity_log").insert({
        task_id: id,
        action: "updated",
        details: { changes },
        performed_by: user.id,
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// PATCH - Partial update task
export async function PATCH(
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

    // Get current task for activity logging
    const { data: currentTask } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", id)
      .single();

    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        ...body,
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
      console.error("Error updating task:", error);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    // Log activity
    const changes: Record<string, { from: any; to: any }> = {};
    for (const key of Object.keys(body)) {
      if (currentTask && currentTask[key] !== body[key]) {
        changes[key] = { from: currentTask[key], to: body[key] };
      }
    }

    if (Object.keys(changes).length > 0) {
      await supabase.from("task_activity_log").insert({
        task_id: id,
        action: "updated",
        details: { changes },
        performed_by: user.id,
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
  }
}

// DELETE - Delete task
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

  try {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Error deleting task:", error);
      return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 });
  }
}
