import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";
  const category = searchParams.get("category");
  const priority = searchParams.get("priority");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Build query
    let query = supabase
      .from("email_classifications")
      .select(`
        id,
        email_message_id,
        category,
        subcategory,
        is_business_relevant,
        priority_score,
        priority_factors,
        sentiment,
        urgency,
        requires_response,
        response_deadline,
        summary,
        key_points,
        extracted_dates,
        extracted_amounts,
        extracted_document_types,
        extracted_names,
        suggested_assignee_id,
        suggested_column,
        assignment_reason,
        draft_response,
        model_used,
        confidence,
        created_at,
        updated_at
      `)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data: classifications, error } = await query;

    if (error) {
      console.error("Error fetching classifications:", error);
      return NextResponse.json({ error: "Failed to fetch data" }, { status: 500 });
    }

    // Transform to intelligence format
    const intelligences = (classifications || []).map((c: any) => ({
      id: c.id,
      emailId: c.email_message_id,
      category: c.category,
      subcategory: c.subcategory,
      isBusinessRelevant: c.is_business_relevant,
      priorityScore: c.priority_score,
      sentiment: c.sentiment,
      urgency: c.urgency,
      requiresResponse: c.requires_response,
      responseDeadline: c.response_deadline,
      summary: c.summary,
      keyPoints: c.key_points || [],
      extractedDates: c.extracted_dates || [],
      extractedAmounts: c.extracted_amounts || [],
      extractedDocumentTypes: c.extracted_document_types || [],
      extractedNames: c.extracted_names || [],
      suggestedAssigneeId: c.suggested_assignee_id,
      assignmentReason: c.assignment_reason,
      draftResponse: c.draft_response,
      confidence: c.confidence,
      processedAt: c.created_at,
      // Map priority score to priority level
      priority:
        c.priority_score >= 80
          ? "urgent"
          : c.priority_score >= 60
          ? "high"
          : c.priority_score >= 40
          ? "medium"
          : "low",
      status: "pending", // Default status - would come from separate status tracking
      actionItems: [], // Would be populated from email_action_items table
    }));

    return NextResponse.json({
      intelligences,
      total: intelligences.length,
      offset,
      limit,
    });
  } catch (error) {
    console.error("Error in email-intelligence API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
