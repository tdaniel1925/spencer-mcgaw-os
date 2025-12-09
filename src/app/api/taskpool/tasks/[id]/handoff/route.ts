import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/taskpool/tasks/[id]/handoff - Handoff task to another user
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
    const { handoff_to, handoff_notes } = body;

    if (!handoff_to) {
      return NextResponse.json({ error: "handoff_to is required" }, { status: 400 });
    }

    // Get the task to verify ownership/claim
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("claimed_by, assigned_to, title")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Update the task with handoff info
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        handoff_to,
        handoff_notes: handoff_notes || null,
        handoff_from: user.id,
        handoff_at: new Date().toISOString(),
        // Optionally release the claim and reassign
        claimed_by: null,
        claimed_at: null,
        assigned_to: handoff_to,
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) throw updateError;

    // Record handoff in history
    await supabase.from("task_handoff_history").insert({
      task_id: taskId,
      from_user_id: user.id,
      to_user_id: handoff_to,
      notes: handoff_notes || null,
    });

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: taskId,
      action: "handed_off",
      details: { to_user_id: handoff_to, notes: handoff_notes },
      performed_by: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error handing off task:", error);
    return NextResponse.json({ error: "Failed to handoff task" }, { status: 500 });
  }
}

// GET /api/taskpool/tasks/[id]/handoff - Get handoff history for a task
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
    const { data: history, error } = await supabase
      .from("task_handoff_history")
      .select(`
        id,
        notes,
        created_at,
        from_user:from_user_id (
          id,
          full_name,
          email,
          avatar_url
        ),
        to_user:to_user_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ history: history || [] });
  } catch (error) {
    console.error("Error fetching handoff history:", error);
    return NextResponse.json({ error: "Failed to fetch handoff history" }, { status: 500 });
  }
}

// DELETE /api/taskpool/tasks/[id]/handoff - Accept/Clear a handoff (acknowledge receipt)
export async function DELETE(
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
    // Verify user is the handoff recipient
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("handoff_to")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.handoff_to !== user.id) {
      return NextResponse.json({ error: "You are not the handoff recipient" }, { status: 403 });
    }

    // Clear handoff fields and claim the task
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        handoff_to: null,
        handoff_notes: null,
        handoff_from: null,
        handoff_at: null,
        claimed_by: user.id,
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId);

    if (updateError) throw updateError;

    // Log activity
    await supabase.from("task_activity_log").insert({
      task_id: taskId,
      action: "handoff_accepted",
      details: {},
      performed_by: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error accepting handoff:", error);
    return NextResponse.json({ error: "Failed to accept handoff" }, { status: 500 });
  }
}
