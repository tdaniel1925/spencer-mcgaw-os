import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    // TODO: Check if user has tasks.assign permission
    // For now, allow all authenticated users (can be restricted later)

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
        client:client_contacts(id, first_name, last_name, company)
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

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error assigning task:", error);
    return NextResponse.json({ error: "Failed to assign task" }, { status: 500 });
  }
}

// DELETE - Unassign a task
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
        client:client_contacts(id, first_name, last_name, company)
      `)
      .single();

    if (error) {
      console.error("Error unassigning task:", error);
      return NextResponse.json({ error: "Failed to unassign task" }, { status: 500 });
    }

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: id,
      action: "unassigned",
      details: { unassigned_by: user.id },
      performed_by: user.id,
    });

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error unassigning task:", error);
    return NextResponse.json({ error: "Failed to unassign task" }, { status: 500 });
  }
}
