import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status") || "pending";
  const category = searchParams.get("category");
  const priority = searchParams.get("priority");
  // Enforce parameter bounds to prevent memory issues
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Build query - include email metadata columns
    let query = supabase
      .from("email_classifications")
      .select(`
        id,
        email_message_id,
        account_id,
        sender_name,
        sender_email,
        subject,
        has_attachments,
        received_at,
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
      .order("received_at", { ascending: false, nullsFirst: false })
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

    // Get all email message IDs to fetch action items
    const emailIds = (classifications || []).map((c: any) => c.email_message_id);

    // Fetch action items for all emails in one query
    const { data: actionItems } = await supabase
      .from("email_action_items")
      .select("*")
      .in("email_message_id", emailIds);

    // Group action items by email_message_id
    const actionItemsByEmail: Record<string, any[]> = {};
    (actionItems || []).forEach((item: any) => {
      if (!actionItemsByEmail[item.email_message_id]) {
        actionItemsByEmail[item.email_message_id] = [];
      }
      actionItemsByEmail[item.email_message_id].push({
        id: item.id,
        title: item.title,
        description: item.description,
        type: item.action_type,
        dueDate: item.mentioned_date,
        priority: item.priority,
        confidence: item.confidence,
        status: item.status,
      });
    });

    // Transform to intelligence format with email metadata
    const intelligences = (classifications || []).map((c: any) => ({
      id: c.id,
      emailId: c.email_message_id,
      accountId: c.account_id,
      // Email metadata
      from: {
        name: c.sender_name || "Unknown",
        email: c.sender_email || "",
      },
      subject: c.subject || "(No Subject)",
      hasAttachments: c.has_attachments || false,
      receivedAt: c.received_at,
      // Classification data
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
      actionItems: actionItemsByEmail[c.email_message_id] || [],
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
