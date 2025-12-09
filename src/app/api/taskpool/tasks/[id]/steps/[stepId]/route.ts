import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/taskpool/tasks/[id]/steps/[stepId] - Update a step
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: taskId, stepId } = await params;

  try {
    const body = await request.json();
    const { description, assigned_to, is_completed } = body;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (description !== undefined) {
      updates.description = description.trim();
    }

    if (assigned_to !== undefined) {
      updates.assigned_to = assigned_to || null;
    }

    if (is_completed !== undefined) {
      updates.is_completed = is_completed;
      if (is_completed) {
        updates.completed_by = user.id;
        updates.completed_at = new Date().toISOString();
      } else {
        updates.completed_by = null;
        updates.completed_at = null;
      }
    }

    const { data: step, error } = await supabase
      .from("task_steps")
      .update(updates)
      .eq("id", stepId)
      .eq("task_id", taskId)
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
      .single();

    if (error) throw error;

    // Log activity if step was completed
    if (is_completed !== undefined) {
      await supabase.from("task_activity_log").insert({
        task_id: taskId,
        action: is_completed ? "step_completed" : "step_uncompleted",
        details: { step_id: stepId, step_number: step.step_number },
        performed_by: user.id,
      });

      // Check if all steps are completed - if so, prompt for task completion
      const { data: allSteps } = await supabase
        .from("task_steps")
        .select("is_completed")
        .eq("task_id", taskId);

      if (allSteps && allSteps.length > 0 && allSteps.every(s => s.is_completed)) {
        // All steps completed - could trigger notification or auto-complete
        // For now, just return a flag
        return NextResponse.json({ step, all_steps_completed: true });
      }
    }

    return NextResponse.json({ step });
  } catch (error) {
    console.error("Error updating task step:", error);
    return NextResponse.json({ error: "Failed to update step" }, { status: 500 });
  }
}

// DELETE /api/taskpool/tasks/[id]/steps/[stepId] - Delete a step
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id: taskId, stepId } = await params;

  try {
    // Get step info before deleting
    const { data: stepInfo } = await supabase
      .from("task_steps")
      .select("step_number, description")
      .eq("id", stepId)
      .single();

    const { error } = await supabase
      .from("task_steps")
      .delete()
      .eq("id", stepId)
      .eq("task_id", taskId);

    if (error) throw error;

    // Log activity
    if (stepInfo) {
      await supabase.from("task_activity_log").insert({
        task_id: taskId,
        action: "step_deleted",
        details: { step_number: stepInfo.step_number, description: stepInfo.description },
        performed_by: user.id,
      });
    }

    // Reorder remaining steps
    const { data: remainingSteps } = await supabase
      .from("task_steps")
      .select("id")
      .eq("task_id", taskId)
      .order("step_number", { ascending: true });

    if (remainingSteps) {
      for (let i = 0; i < remainingSteps.length; i++) {
        await supabase
          .from("task_steps")
          .update({ step_number: i + 1 })
          .eq("id", remainingSteps[i].id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task step:", error);
    return NextResponse.json({ error: "Failed to delete step" }, { status: 500 });
  }
}
