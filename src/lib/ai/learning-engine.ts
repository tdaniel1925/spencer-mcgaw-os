/**
 * AI Learning Engine
 *
 * Records user feedback and extracts patterns to improve future task suggestions.
 * Learns from:
 * - Approvals (which suggestions were correct)
 * - Declines (which suggestions were wrong and why)
 * - Modifications (what users changed from AI suggestions)
 * - Reassignments (who should handle what types of tasks)
 */

import { createClient } from "@/lib/supabase/server";

// Types
export interface FeedbackInput {
  suggestionId?: string;
  taskId?: string;
  feedbackType:
    | "suggestion_reviewed"
    | "task_reassigned"
    | "task_completed"
    | "task_cancelled";
  userAction:
    | "approved"
    | "declined"
    | "modified"
    | "reassigned"
    | "completed"
    | "cancelled";
  wasAICorrect: boolean;
  correctionType?: string;
  correctionReason?: string;
  feedbackBy: string;
  suggestion?: SuggestionData;
  modifications?: Record<string, unknown>;
  newAssignee?: string;
}

interface SuggestionData {
  id: string;
  source_type: string;
  source_id: string;
  suggested_title: string;
  suggested_assigned_to?: string;
  suggested_priority?: string;
  suggested_client_id?: string;
  ai_confidence: number;
  ai_category?: string;
  ai_keywords?: string[];
  source_metadata?: Record<string, unknown>;
}

interface PatternCandidate {
  pattern_type: string;
  match_call_category?: string;
  match_keywords?: string[];
  match_client_id?: string;
  match_caller_phone?: string;
  suggest_assigned_to?: string;
  suggest_action_type_id?: string;
  suggest_priority?: string;
}

/**
 * Record user feedback on an AI suggestion for learning
 */
export async function recordSuggestionFeedback(
  input: FeedbackInput
): Promise<string | null> {
  const supabase = await createClient();

  // Get suggestion details if not provided
  let suggestion = input.suggestion;
  if (!suggestion && input.suggestionId) {
    const { data } = await supabase
      .from("task_ai_suggestions")
      .select("*")
      .eq("id", input.suggestionId)
      .single();
    suggestion = data as SuggestionData | undefined;
  }

  // Build feedback record
  const feedbackRecord = {
    feedback_type: input.feedbackType,
    suggestion_id: input.suggestionId,
    task_id: input.taskId,
    source_type: suggestion?.source_type,
    source_id: suggestion?.source_id,
    call_category: suggestion?.ai_category,
    call_keywords: suggestion?.ai_keywords,
    client_id: suggestion?.suggested_client_id,
    caller_phone: (suggestion?.source_metadata as Record<string, string>)?.callerPhone,
    ai_suggested_action: suggestion?.ai_category,
    ai_suggested_assignee: suggestion?.suggested_assigned_to,
    ai_suggested_priority: suggestion?.suggested_priority,
    ai_confidence: suggestion?.ai_confidence,
    user_action: input.userAction,
    user_assigned_to:
      input.newAssignee ||
      (input.modifications?.assignedTo as string) ||
      suggestion?.suggested_assigned_to,
    user_priority:
      (input.modifications?.priority as string) || suggestion?.suggested_priority,
    was_ai_correct: input.wasAICorrect,
    correction_type: input.correctionType,
    correction_reason: input.correctionReason,
    feedback_by: input.feedbackBy,
    metadata: {
      modifications: input.modifications,
      original_suggestion: suggestion,
    },
  };

  // Insert feedback
  const { data: feedback, error } = await supabase
    .from("task_ai_feedback")
    .insert(feedbackRecord)
    .select("id")
    .single();

  if (error) {
    console.error("[Learning Engine] Error recording feedback:", error);
    return null;
  }

  // Trigger pattern extraction asynchronously
  extractPatternsFromFeedback(feedback.id).catch((err) => {
    console.error("[Learning Engine] Error extracting patterns:", err);
  });

  return feedback.id;
}

/**
 * Extract patterns from accumulated feedback
 */
async function extractPatternsFromFeedback(feedbackId: string): Promise<void> {
  const supabase = await createClient();

  // Get the feedback record
  const { data: feedback } = await supabase
    .from("task_ai_feedback")
    .select("*")
    .eq("id", feedbackId)
    .single();

  if (!feedback) return;

  // Only learn from certain feedback types
  const learnableActions = ["approved", "declined", "modified", "reassigned"];
  if (!learnableActions.includes(feedback.user_action)) return;

  // Generate pattern candidates based on feedback
  const candidates: PatternCandidate[] = [];

  // Pattern 1: Category -> User assignment
  if (feedback.call_category && feedback.user_assigned_to) {
    candidates.push({
      pattern_type: "category_to_user",
      match_call_category: feedback.call_category,
      suggest_assigned_to: feedback.user_assigned_to,
      suggest_priority: feedback.user_priority,
    });
  }

  // Pattern 2: Client -> User assignment
  if (feedback.client_id && feedback.user_assigned_to) {
    candidates.push({
      pattern_type: "client_to_user",
      match_client_id: feedback.client_id,
      suggest_assigned_to: feedback.user_assigned_to,
    });
  }

  // Pattern 3: Caller phone -> User assignment (for repeat callers)
  if (feedback.caller_phone && feedback.user_assigned_to) {
    candidates.push({
      pattern_type: "caller_to_user",
      match_caller_phone: feedback.caller_phone,
      suggest_assigned_to: feedback.user_assigned_to,
    });
  }

  // Pattern 4: Keywords -> Action/Category
  if (
    feedback.call_keywords &&
    feedback.call_keywords.length > 0 &&
    feedback.user_action !== "declined"
  ) {
    candidates.push({
      pattern_type: "keyword_to_action",
      match_keywords: feedback.call_keywords,
      match_call_category: feedback.call_category,
      suggest_priority: feedback.user_priority,
    });
  }

  // Update or create patterns
  for (const candidate of candidates) {
    await updateOrCreatePattern(candidate, feedback, supabase);
  }
}

/**
 * Update existing pattern or create new one
 */
async function updateOrCreatePattern(
  candidate: PatternCandidate,
  feedback: Record<string, unknown>,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<void> {
  // Find existing pattern
  let query = supabase
    .from("task_ai_patterns")
    .select("*")
    .eq("pattern_type", candidate.pattern_type);

  if (candidate.match_call_category) {
    query = query.eq("match_call_category", candidate.match_call_category);
  }
  if (candidate.match_client_id) {
    query = query.eq("match_client_id", candidate.match_client_id);
  }
  if (candidate.match_caller_phone) {
    query = query.eq("match_caller_phone", candidate.match_caller_phone);
  }

  const { data: existingPatterns } = await query;

  const wasAccepted =
    feedback.user_action === "approved" ||
    (feedback.user_action === "modified" && feedback.was_ai_correct);
  const wasRejected = feedback.user_action === "declined";

  if (existingPatterns && existingPatterns.length > 0) {
    // Update existing pattern
    const pattern = existingPatterns[0];
    const newTimesAccepted = (pattern.times_accepted || 0) + (wasAccepted ? 1 : 0);
    const newTimesRejected = (pattern.times_rejected || 0) + (wasRejected ? 1 : 0);
    const totalFeedback = newTimesAccepted + newTimesRejected;

    // Calculate new acceptance rate
    const acceptanceRate =
      totalFeedback > 0 ? newTimesAccepted / totalFeedback : 0.5;

    // Calculate confidence score based on volume and rate
    // More feedback = more confidence, but rate matters too
    const volumeScore = Math.min(totalFeedback / 20, 1); // Max out at 20 samples
    const confidenceScore = acceptanceRate * 0.7 + volumeScore * 0.3;

    // Update pattern
    await supabase
      .from("task_ai_patterns")
      .update({
        times_accepted: newTimesAccepted,
        times_rejected: newTimesRejected,
        acceptance_rate: Math.round(acceptanceRate * 100) / 100,
        confidence_score: Math.round(confidenceScore * 100) / 100,
        // Update suggestion if user modified it
        suggest_assigned_to:
          candidate.suggest_assigned_to || pattern.suggest_assigned_to,
        suggest_priority:
          candidate.suggest_priority || pattern.suggest_priority,
        updated_at: new Date().toISOString(),
        learned_from_feedback_ids: [
          ...(pattern.learned_from_feedback_ids || []),
          feedback.id,
        ].slice(-100), // Keep last 100 feedback IDs
      })
      .eq("id", pattern.id);
  } else if (!wasRejected) {
    // Create new pattern (only if not rejected)
    await supabase.from("task_ai_patterns").insert({
      pattern_type: candidate.pattern_type,
      match_call_category: candidate.match_call_category,
      match_keywords: candidate.match_keywords,
      match_client_id: candidate.match_client_id,
      match_caller_phone: candidate.match_caller_phone,
      suggest_assigned_to: candidate.suggest_assigned_to,
      suggest_action_type_id: candidate.suggest_action_type_id,
      suggest_priority: candidate.suggest_priority,
      times_matched: 0,
      times_accepted: wasAccepted ? 1 : 0,
      times_rejected: 0,
      acceptance_rate: wasAccepted ? 1.0 : 0.5,
      confidence_score: 0.3, // Start with low confidence
      is_active: true,
      requires_review: true,
      learned_from_feedback_ids: [feedback.id],
    });
  }
}

/**
 * Record when a task is reassigned (for learning user assignments)
 */
export async function recordTaskReassignment(
  taskId: string,
  originalAssignee: string | null,
  newAssignee: string,
  reassignedBy: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  const supabase = await createClient();

  // Find if this task was created from a suggestion
  const { data: task } = await supabase
    .from("tasks")
    .select("metadata, client_id")
    .eq("id", taskId)
    .single();

  const taskMetadata = task?.metadata as Record<string, unknown> | undefined;
  const suggestionId = taskMetadata?.suggestion_id as string | undefined;

  await recordSuggestionFeedback({
    suggestionId,
    taskId,
    feedbackType: "task_reassigned",
    userAction: "reassigned",
    wasAICorrect: false,
    correctionType: "assignee",
    correctionReason: `Reassigned from ${originalAssignee || "unassigned"} to ${newAssignee}`,
    feedbackBy: reassignedBy,
    newAssignee,
    modifications: {
      originalAssignee,
      newAssignee,
      ...metadata,
    },
  });
}

/**
 * Get pattern statistics for analytics
 */
export async function getPatternStats(): Promise<{
  totalPatterns: number;
  activePatterns: number;
  averageAcceptance: number;
  topPatterns: unknown[];
}> {
  const supabase = await createClient();

  const { data: patterns } = await supabase
    .from("task_ai_patterns")
    .select("*")
    .order("confidence_score", { ascending: false });

  if (!patterns || patterns.length === 0) {
    return {
      totalPatterns: 0,
      activePatterns: 0,
      averageAcceptance: 0,
      topPatterns: [],
    };
  }

  const activePatterns = patterns.filter((p) => p.is_active);
  const totalAcceptance = patterns.reduce(
    (sum, p) => sum + (p.acceptance_rate || 0),
    0
  );

  return {
    totalPatterns: patterns.length,
    activePatterns: activePatterns.length,
    averageAcceptance: Math.round((totalAcceptance / patterns.length) * 100),
    topPatterns: patterns.slice(0, 10).map((p) => ({
      id: p.id,
      type: p.pattern_type,
      category: p.match_call_category,
      confidence: p.confidence_score,
      acceptance: p.acceptance_rate,
      timesMatched: p.times_matched,
    })),
  };
}

/**
 * Mark expired suggestions (run periodically)
 */
export async function expireOldSuggestions(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_ai_suggestions")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("status", "pending")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    console.error("[Learning Engine] Error expiring suggestions:", error);
    return 0;
  }

  return data?.length || 0;
}
