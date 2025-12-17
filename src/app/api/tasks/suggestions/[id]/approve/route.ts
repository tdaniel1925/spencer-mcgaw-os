import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordSuggestionFeedback } from "@/lib/ai/learning-engine";

interface ApproveBody {
  assignedTo?: string;
  priority?: string;
  dueDate?: string;
  title?: string;
  description?: string;
}

/**
 * POST /api/tasks/suggestions/[id]/approve
 * Approve a suggestion and create a task
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body for any modifications
    let modifications: ApproveBody = {};
    try {
      modifications = await request.json();
    } catch {
      // No modifications provided
    }

    // Fetch the suggestion
    const { data: suggestion, error: fetchError } = await supabase
      .from("task_ai_suggestions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !suggestion) {
      return NextResponse.json(
        { error: "Suggestion not found" },
        { status: 404 }
      );
    }

    if (suggestion.status !== "pending") {
      return NextResponse.json(
        { error: `Suggestion already ${suggestion.status}` },
        { status: 400 }
      );
    }

    // Determine final values (user modifications override AI suggestions)
    const finalTitle = modifications.title || suggestion.suggested_title;
    const finalDescription = modifications.description || suggestion.suggested_description;
    const finalAssignedTo = modifications.assignedTo || suggestion.suggested_assigned_to;
    const finalPriority = modifications.priority || suggestion.suggested_priority || "medium";
    const finalDueDate = modifications.dueDate || suggestion.suggested_due_date;

    // Track what was modified
    const modificationsMade: Record<string, { from: unknown; to: unknown }> = {};
    if (modifications.title && modifications.title !== suggestion.suggested_title) {
      modificationsMade.title = { from: suggestion.suggested_title, to: modifications.title };
    }
    if (modifications.assignedTo && modifications.assignedTo !== suggestion.suggested_assigned_to) {
      modificationsMade.assigned_to = { from: suggestion.suggested_assigned_to, to: modifications.assignedTo };
    }
    if (modifications.priority && modifications.priority !== suggestion.suggested_priority) {
      modificationsMade.priority = { from: suggestion.suggested_priority, to: modifications.priority };
    }
    if (modifications.dueDate && modifications.dueDate !== suggestion.suggested_due_date) {
      modificationsMade.due_date = { from: suggestion.suggested_due_date, to: modifications.dueDate };
    }

    const wasModified = Object.keys(modificationsMade).length > 0;

    // Create the task
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title: finalTitle,
        description: finalDescription,
        assigned_to: finalAssignedTo,
        client_id: suggestion.suggested_client_id,
        priority: finalPriority,
        due_date: finalDueDate,
        status: "pending",
        action_type_id: suggestion.suggested_action_type_id,
        source_call_id: suggestion.source_type === "phone_call" ? suggestion.source_id : null,
        created_by: user.id,
        metadata: {
          ai_suggested: true,
          suggestion_id: id,
          ai_confidence: suggestion.ai_confidence,
          ai_category: suggestion.ai_category,
          was_modified: wasModified,
        },
      })
      .select("id")
      .single();

    if (taskError || !task) {
      console.error("[Approve API] Error creating task:", taskError);
      return NextResponse.json(
        { error: "Failed to create task", details: taskError?.message },
        { status: 500 }
      );
    }

    // Update the suggestion status
    await supabase
      .from("task_ai_suggestions")
      .update({
        status: "approved",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_action: wasModified ? "modified" : "approved",
        created_task_id: task.id,
        modifications: wasModified ? modificationsMade : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    // Record feedback for learning
    try {
      await recordSuggestionFeedback({
        suggestionId: id,
        taskId: task.id,
        feedbackType: "suggestion_reviewed",
        userAction: wasModified ? "modified" : "approved",
        wasAICorrect: !wasModified,
        correctionType: wasModified
          ? Object.keys(modificationsMade).join(",")
          : undefined,
        feedbackBy: user.id,
        suggestion,
        modifications: wasModified ? (modifications as Record<string, unknown>) : undefined,
      });
    } catch (feedbackError) {
      console.error("[Approve API] Error recording feedback:", feedbackError);
      // Don't fail the approval if feedback recording fails
    }

    return NextResponse.json({
      success: true,
      taskId: task.id,
      suggestionId: id,
      wasModified,
      modifications: wasModified ? modificationsMade : null,
    });
  } catch (error) {
    console.error("[Approve API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
