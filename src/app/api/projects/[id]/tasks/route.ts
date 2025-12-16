import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List tasks for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: tasks, error } = await supabase
      .from("project_tasks")
      .select(`
        *,
        assigned_user:users!project_tasks_assigned_to_fkey(id, email, full_name)
      `)
      .eq("project_id", projectId)
      .order("sort_order");

    if (error) throw error;

    return NextResponse.json({ tasks: tasks || [] });
  } catch (error) {
    console.error("Error fetching project tasks:", error);
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

// POST - Create a new task for a project
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

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
      task_type,
      assigned_to,
      due_date,
      estimated_hours,
      sort_order,
    } = body;

    if (!title) {
      return NextResponse.json({ error: "Task title is required" }, { status: 400 });
    }

    // Get max sort_order for this project
    const { data: maxTask } = await supabase
      .from("project_tasks")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .single();

    const newSortOrder = sort_order ?? ((maxTask?.sort_order || 0) + 1);

    const { data: task, error } = await supabase
      .from("project_tasks")
      .insert({
        project_id: projectId,
        title,
        description,
        task_type: task_type || "firm_task",
        assigned_to,
        due_date,
        estimated_hours,
        sort_order: newSortOrder,
        status: "pending",
      })
      .select(`
        *,
        assigned_user:users!project_tasks_assigned_to_fkey(id, email, full_name)
      `)
      .single();

    if (error) throw error;

    // Update project progress
    await updateProjectProgress(supabase, projectId);

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    console.error("Error creating project task:", error);
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

// PATCH - Bulk update tasks (for reordering or batch status updates)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tasks } = body;

    if (!tasks || !Array.isArray(tasks)) {
      return NextResponse.json({ error: "tasks array is required" }, { status: 400 });
    }

    // Update each task
    for (const task of tasks) {
      if (!task.id) continue;

      const updates: Record<string, unknown> = {};
      if (task.sort_order !== undefined) updates.sort_order = task.sort_order;
      if (task.status !== undefined) {
        updates.status = task.status;
        if (task.status === "completed") {
          updates.completed_at = new Date().toISOString();
          updates.completed_by = user.id;
        }
      }
      if (task.assigned_to !== undefined) updates.assigned_to = task.assigned_to;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("project_tasks")
          .update(updates)
          .eq("id", task.id)
          .eq("project_id", projectId);
      }
    }

    // Update project progress
    await updateProjectProgress(supabase, projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating project tasks:", error);
    return NextResponse.json({ error: "Failed to update tasks" }, { status: 500 });
  }
}

// Helper to update project progress based on task completion
async function updateProjectProgress(supabase: Awaited<ReturnType<typeof createClient>>, projectId: string) {
  const { data: tasks } = await supabase
    .from("project_tasks")
    .select("status")
    .eq("project_id", projectId);

  if (tasks && tasks.length > 0) {
    const completed = tasks.filter(t => t.status === "completed").length;
    const progress = Math.round((completed / tasks.length) * 100);

    await supabase
      .from("projects")
      .update({ progress_percent: progress })
      .eq("id", projectId);
  }
}
