import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordSuggestionFeedback } from "@/lib/ai/learning-engine";

interface DeclineBody {
  reason: string;
  category: "not_needed" | "duplicate" | "wrong_type" | "wrong_assignee" | "wrong_client" | "other";
}

/**
 * POST /api/tasks/suggestions/[id]/decline
 * Decline a suggestion with reason (for AI learning)
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

    // Parse request body for decline reason
    let body: DeclineBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body required with reason and category" },
        { status: 400 }
      );
    }

    if (!body.reason || !body.category) {
      return NextResponse.json(
        { error: "Both reason and category are required" },
        { status: 400 }
      );
    }

    const validCategories = ["not_needed", "duplicate", "wrong_type", "wrong_assignee", "wrong_client", "other"];
    if (!validCategories.includes(body.category)) {
      return NextResponse.json(
        { error: `Invalid category. Must be one of: ${validCategories.join(", ")}` },
        { status: 400 }
      );
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

    // Update the suggestion status
    const { error: updateError } = await supabase
      .from("task_ai_suggestions")
      .update({
        status: "declined",
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_action: "declined",
        decline_reason: body.reason,
        decline_category: body.category,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      console.error("[Decline API] Error updating suggestion:", updateError);
      return NextResponse.json(
        { error: "Failed to decline suggestion", details: updateError.message },
        { status: 500 }
      );
    }

    // Record feedback for learning - this is crucial for improving AI
    try {
      await recordSuggestionFeedback({
        suggestionId: id,
        feedbackType: "suggestion_reviewed",
        userAction: "declined",
        wasAICorrect: false,
        correctionType: body.category,
        correctionReason: body.reason,
        feedbackBy: user.id,
        suggestion,
      });
    } catch (feedbackError) {
      console.error("[Decline API] Error recording feedback:", feedbackError);
      // Don't fail the decline if feedback recording fails
    }

    return NextResponse.json({
      success: true,
      suggestionId: id,
      declineCategory: body.category,
      message: "Suggestion declined. Your feedback will help improve future suggestions.",
    });
  } catch (error) {
    console.error("[Decline API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
