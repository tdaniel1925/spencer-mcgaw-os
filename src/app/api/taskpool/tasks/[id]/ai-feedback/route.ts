import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/taskpool/tasks/[id]/ai-feedback - Submit AI training feedback
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
    const { corrected_action_type_id, feedback_text, was_correct } = body;

    // Get the task to capture original action type
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("action_type_id, ai_confidence")
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Insert feedback record
    const { data: feedback, error: feedbackError } = await supabase
      .from("ai_training_feedback")
      .insert({
        task_id: taskId,
        original_action_type_id: task.action_type_id,
        corrected_action_type_id: was_correct ? null : corrected_action_type_id,
        feedback_text: feedback_text || null,
        was_correct: was_correct ?? false,
        submitted_by: user.id,
      })
      .select()
      .single();

    if (feedbackError) throw feedbackError;

    // If user corrected the classification, update the task
    if (!was_correct && corrected_action_type_id) {
      const { error: updateError } = await supabase
        .from("tasks")
        .update({
          action_type_id: corrected_action_type_id,
          ai_corrected: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from("task_activity_log").insert({
        task_id: taskId,
        action: "ai_corrected",
        details: {
          original_action_type_id: task.action_type_id,
          corrected_action_type_id,
          feedback_text,
        },
        performed_by: user.id,
      });
    } else if (was_correct) {
      // Log that AI was confirmed correct
      await supabase.from("task_activity_log").insert({
        task_id: taskId,
        action: "ai_confirmed",
        details: { confidence: task.ai_confidence },
        performed_by: user.id,
      });
    }

    return NextResponse.json({ feedback, updated: !was_correct });
  } catch (error) {
    console.error("Error submitting AI feedback:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

// GET /api/taskpool/tasks/[id]/ai-feedback - Get feedback history for a task
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
    const { data: feedback, error } = await supabase
      .from("ai_training_feedback")
      .select(`
        id,
        feedback_text,
        was_correct,
        created_at,
        original_action_type:original_action_type_id (
          id,
          code,
          label,
          color
        ),
        corrected_action_type:corrected_action_type_id (
          id,
          code,
          label,
          color
        ),
        submitted_user:submitted_by (
          id,
          full_name,
          email
        )
      `)
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ feedback: feedback || [] });
  } catch (error) {
    console.error("Error fetching AI feedback:", error);
    return NextResponse.json({ error: "Failed to fetch feedback" }, { status: 500 });
  }
}
