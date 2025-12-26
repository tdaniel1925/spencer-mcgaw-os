import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface InboxItem {
  id: string;
  emailId: string;
  accountId: string;
  accountEmail: string;
  from: {
    name: string;
    email: string;
  };
  subject: string;
  summary: string | null;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  priorityScore: number;
  sentiment: string | null;
  urgency: string | null;
  requiresResponse: boolean;
  hasAttachments: boolean;
  receivedAt: string;
  keyPoints: string[];
  actionItems: Array<{
    id: string;
    title: string;
    type: string;
    status: string;
  }>;
}

/**
 * GET /api/my-inbox
 * Returns personal emails for the current user (from non-global accounts)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get("category");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    // Get user's personal (non-global) email accounts
    const { data: personalAccounts } = await supabase
      .from("email_connections")
      .select("id, email")
      .eq("user_id", user.id)
      .eq("is_global", false);

    if (!personalAccounts || personalAccounts.length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        hasMore: false,
        accountCount: 0,
      });
    }

    const accountIds = personalAccounts.map(a => a.id);
    const accountEmailMap = new Map(personalAccounts.map(a => [a.id, a.email]));

    // Build query using columns that exist (same as email-intelligence)
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
        sentiment,
        urgency,
        requires_response,
        summary,
        key_points,
        confidence,
        created_at
      `, { count: "exact" })
      .in("account_id", accountIds)
      .order("received_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    // Apply category filter if provided
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    const { data: emails, error, count } = await query;

    if (error) {
      console.error("[My Inbox API] Error fetching emails:", error);
      return NextResponse.json(
        { error: "Failed to fetch emails" },
        { status: 500 }
      );
    }

    if (!emails || emails.length === 0) {
      return NextResponse.json({
        items: [],
        total: 0,
        hasMore: false,
        accountCount: personalAccounts.length,
      });
    }

    // Get action items for these emails
    const emailMessageIds = emails.map(e => e.email_message_id).filter(Boolean);
    let actionItemsByEmail: Record<string, Array<{ id: string; title: string; type: string; status: string }>> = {};

    if (emailMessageIds.length > 0) {
      const { data: actionItems } = await supabase
        .from("email_action_items")
        .select("*")
        .in("email_message_id", emailMessageIds);

      if (actionItems) {
        for (const item of actionItems) {
          if (!actionItemsByEmail[item.email_message_id]) {
            actionItemsByEmail[item.email_message_id] = [];
          }
          actionItemsByEmail[item.email_message_id].push({
            id: item.id,
            title: item.title,
            type: item.action_type,
            status: item.status,
          });
        }
      }
    }

    // Transform to InboxItem format
    const items: InboxItem[] = emails.map(email => ({
      id: email.id,
      emailId: email.email_message_id || email.id,
      accountId: email.account_id,
      accountEmail: accountEmailMap.get(email.account_id) || "",
      from: {
        name: email.sender_name || "Unknown",
        email: email.sender_email || "",
      },
      subject: email.subject || "(No Subject)",
      summary: email.summary || null,
      category: email.category || "other",
      priority: email.priority_score >= 80 ? "urgent"
        : email.priority_score >= 60 ? "high"
        : email.priority_score >= 40 ? "medium"
        : "low",
      priorityScore: email.priority_score || 50,
      sentiment: email.sentiment || null,
      urgency: email.urgency || null,
      requiresResponse: email.requires_response || false,
      hasAttachments: email.has_attachments || false,
      receivedAt: email.received_at || email.created_at,
      keyPoints: email.key_points || [],
      actionItems: actionItemsByEmail[email.email_message_id] || [],
    }));

    return NextResponse.json({
      items,
      total: count || items.length,
      hasMore: offset + limit < (count || 0),
      accountCount: personalAccounts.length,
    });
  } catch (error) {
    console.error("[My Inbox API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch inbox" },
      { status: 500 }
    );
  }
}
