import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/taskpool/tasks/[id]/steps - Get all steps for a task
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: taskId } = await params;

  try {
    const { data: steps, error } = await supabase
      .from("task_steps")
      .select(`
        *,
        assigned_user:assigned_to (
          id,
          full_name,
          email,
          avatar_url
        ),
        completed_user:completed_by (
          id,
          full_name,
          email
        )
      `)
      .eq("task_id", taskId)
      .order("step_number", { ascending: true });

    if (error) throw error;

    return NextResponse.json({ steps: steps || [] });
  } catch (error) {
    console.error("Error fetching task steps:", error);
    return NextResponse.json({ error: "Failed to fetch steps" }, { status: 500 });
  }
}

// POST /api/taskpool/tasks/[id]/steps - Add a new step
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { description, assigned_to } = body;

    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    // Get the next step number
    const { data: existingSteps } = await supabase
      .from("task_steps")
      .select("step_number")
      .eq("task_id", taskId)
      .order("step_number", { ascending: false })
      .limit(1);

    const nextStepNumber = existingSteps && existingSteps.length > 0
      ? existingSteps[0].step_number + 1
      : 1;

    const { data: step, error } = await supabase
      .from("task_steps")
      .insert({
        task_id: taskId,
        step_number: nextStepNumber,
        description: description.trim(),
        assigned_to: assigned_to || null,
        is_completed: false,
      })
      .select(`
        *,
        assigned_user:assigned_to (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .single();

    if (error) throw error;

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: taskId,
      action: "step_added",
      details: { step_number: nextStepNumber, description: description.trim() },
      performed_by: user.id,
    });

    return NextResponse.json({ step });
  } catch (error) {
    console.error("Error adding task step:", error);
    return NextResponse.json({ error: "Failed to add step" }, { status: 500 });
  }
}

// PUT /api/taskpool/tasks/[id]/steps - Reorder steps
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: taskId } = await params;

  try {
    const body = await request.json();
    const { step_ids } = body; // Array of step IDs in new order

    if (!Array.isArray(step_ids)) {
      return NextResponse.json({ error: "step_ids array is required" }, { status: 400 });
    }

    // Update each step with its new order
    for (let i = 0; i < step_ids.length; i++) {
      await supabase
        .from("task_steps")
        .update({ step_number: i + 1, updated_at: new Date().toISOString() })
        .eq("id", step_ids[i])
        .eq("task_id", taskId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error reordering steps:", error);
    return NextResponse.json({ error: "Failed to reorder steps" }, { status: 500 });
  }
}
