import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Claim a task
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
    // Check if task is already claimed
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("claimed_by, status")
      .eq("id", id)
      .single();

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (existingTask.claimed_by) {
      return NextResponse.json(
        { error: "Task is already claimed" },
        { status: 400 }
      );
    }

    if (existingTask.status !== "open") {
      return NextResponse.json(
        { error: "Task is not available for claiming" },
        { status: 400 }
      );
    }

    // Claim the task
    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
        status: "in_progress",
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
      console.error("Error claiming task:", error);
      return NextResponse.json({ error: "Failed to claim task" }, { status: 500 });
    }

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: id,
      action: "claimed",
      details: { claimed_by: user.id },
      performed_by: user.id,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error claiming task:", error);
    return NextResponse.json({ error: "Failed to claim task" }, { status: 500 });
  }
}

// DELETE - Release a claimed task
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
    // Check if task is claimed by current user
    const { data: existingTask } = await supabase
      .from("tasks")
      .select("claimed_by")
      .eq("id", id)
      .single();

    if (!existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (existingTask.claimed_by !== user.id) {
      return NextResponse.json(
        { error: "You can only release tasks you have claimed" },
        { status: 403 }
      );
    }

    // Release the task
    const { data: task, error } = await supabase
      .from("tasks")
      .update({
        claimed_by: null,
        claimed_at: null,
        status: "open",
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
      console.error("Error releasing task:", error);
      return NextResponse.json({ error: "Failed to release task" }, { status: 500 });
    }

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: id,
      action: "released",
      details: { released_by: user.id },
      performed_by: user.id,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error releasing task:", error);
    return NextResponse.json({ error: "Failed to release task" }, { status: 500 });
  }
}
