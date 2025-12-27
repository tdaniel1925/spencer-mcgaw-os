import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAITaskStats, getSuggestedAssignee } from "@/lib/ai/task-learning";

/**
 * GET /api/ai-learning - Get AI task learning stats and suggestions
 *
 * Query params:
 * - stats: Get overall AI task statistics
 * - suggest_assignee: Get suggested assignee for a source type/category
 *   - source_type: phone_call | email
 *   - category: optional category string
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;

  // Get overall stats
  if (searchParams.has("stats")) {
    try {
      const stats = await getAITaskStats();
      return NextResponse.json({
        success: true,
        stats,
      });
    } catch (error) {
      console.error("Error getting AI stats:", error);
      return NextResponse.json(
        { error: "Failed to get stats" },
        { status: 500 }
      );
    }
  }

  // Get suggested assignee
  if (searchParams.has("suggest_assignee")) {
    const sourceType = searchParams.get("source_type");
    const category = searchParams.get("category");

    if (!sourceType) {
      return NextResponse.json(
        { error: "source_type is required" },
        { status: 400 }
      );
    }

    try {
      const suggestion = await getSuggestedAssignee(sourceType, category);

      if (!suggestion) {
        return NextResponse.json({
          success: true,
          hasSuggestion: false,
          message: "Not enough data to suggest an assignee yet",
        });
      }

      // Get user details for the suggested assignee
      const { data: userDetails } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .eq("id", suggestion.userId)
        .single();

      return NextResponse.json({
        success: true,
        hasSuggestion: true,
        suggestion: {
          userId: suggestion.userId,
          confidence: suggestion.confidence,
          user: userDetails,
        },
      });
    } catch (error) {
      console.error("Error getting suggested assignee:", error);
      return NextResponse.json(
        { error: "Failed to get suggestion" },
        { status: 500 }
      );
    }
  }

  // Get assignment patterns
  if (searchParams.has("patterns")) {
    try {
      const { data: patterns, error } = await supabase
        .from("task_activity_log")
        .select("details, created_at")
        .eq("action", "ai_assignment_pattern")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Aggregate patterns
      const patternSummary: Record<string, Record<string, number>> = {};

      for (const p of patterns || []) {
        const details = p.details as Record<string, unknown>;
        const key = `${details?.source_type || "unknown"}/${details?.category || "general"}`;
        const assignee = details?.assigned_to as string;

        if (!patternSummary[key]) {
          patternSummary[key] = {};
        }
        patternSummary[key][assignee] = (patternSummary[key][assignee] || 0) + 1;
      }

      return NextResponse.json({
        success: true,
        totalPatterns: patterns?.length || 0,
        summary: patternSummary,
      });
    } catch (error) {
      console.error("Error getting patterns:", error);
      return NextResponse.json(
        { error: "Failed to get patterns" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    error: "Invalid request. Use ?stats, ?suggest_assignee, or ?patterns",
  }, { status: 400 });
}
