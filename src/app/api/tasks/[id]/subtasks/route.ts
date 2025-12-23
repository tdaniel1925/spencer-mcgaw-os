import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface Subtask {
  id: string;
  task_id: string;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  position: number;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/tasks/[id]/subtasks
 * Get all subtasks for a task
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: subtasks, error } = await supabase
    .from("subtasks")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true });

  if (error) {
    console.error("[Subtasks API] Error fetching subtasks:", error);
    return NextResponse.json({ error: "Failed to fetch subtasks" }, { status: 500 });
  }

  return NextResponse.json({ subtasks: subtasks || [] });
}

/**
 * POST /api/tasks/[id]/subtasks
 * Create a new subtask
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, description, due_date, position } = body;

    if (!title) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    // Get the next position if not provided
    let nextPosition = position;
    if (nextPosition === undefined) {
      const { data: existingSubtasks } = await supabase
        .from("subtasks")
        .select("position")
        .eq("task_id", taskId)
        .order("position", { ascending: false })
        .limit(1);

      nextPosition = existingSubtasks?.[0]?.position !== undefined
        ? existingSubtasks[0].position + 1
        : 0;
    }

    const { data: subtask, error } = await supabase
      .from("subtasks")
      .insert({
        task_id: taskId,
        title,
        description: description || null,
        due_date: due_date || null,
        position: nextPosition,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("[Subtasks API] Error creating subtask:", error);
      return NextResponse.json({ error: "Failed to create subtask" }, { status: 500 });
    }

    // Log activity
    await supabase.from("task_activity").insert({
      task_id: taskId,
      user_id: user.id,
      action: "subtask_added",
      description: `Added subtask: ${title}`,
      new_value: { subtask_id: subtask.id, title },
    });

    return NextResponse.json({ subtask }, { status: 201 });
  } catch (error) {
    console.error("[Subtasks API] Error creating subtask:", error);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

/**
 * PUT /api/tasks/[id]/subtasks
 * Bulk update subtasks (for reordering)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { subtasks } = body as { subtasks: Array<{ id: string; position: number }> };

    if (!Array.isArray(subtasks)) {
      return NextResponse.json({ error: "Subtasks array is required" }, { status: 400 });
    }

    // Update positions
    const updates = subtasks.map(({ id, position }) =>
      supabase
        .from("subtasks")
        .update({ position, updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("task_id", taskId)
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Subtasks API] Error reordering subtasks:", error);
    return NextResponse.json({ error: "Failed to reorder subtasks" }, { status: 500 });
  }
}
