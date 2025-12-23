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
  bodyPreview: string | null;
  category: string;
  priority: "low" | "medium" | "high" | "urgent";
  sentiment: string | null;
  requiresResponse: boolean;
  hasAttachments: boolean;
  receivedAt: string;
  status: "pending" | "approved" | "dismissed" | "delegated";
  hasTask: boolean;
  matchedClientId: string | null;
  matchedClientName: string | null;
  actionItems: Array<{
    id: string;
    title: string;
    type: string;
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
  const status = searchParams.get("status") || "all";
  const priority = searchParams.get("priority") || "all";
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

    // Build query for email classifications
    let query = supabase
      .from("email_classifications")
      .select(`
        id,
        email_id,
        account_id,
        from_name,
        from_email,
        subject,
        summary,
        body_preview,
        category,
        priority,
        sentiment,
        requires_response,
        has_attachments,
        matched_client_id,
        status,
        created_at
      `, { count: "exact" })
      .in("account_id", accountIds)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status !== "all") {
      query = query.eq("status", status);
    }

    if (priority !== "all") {
      query = query.eq("priority", priority);
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
    const emailIds = emails.map(e => e.email_id);
    const { data: actionItems } = await supabase
      .from("email_action_items")
      .select("email_id, id, title, type")
      .in("email_id", emailIds);

    const actionItemsByEmail = new Map<string, Array<{ id: string; title: string; type: string }>>();
    for (const item of actionItems || []) {
      if (!actionItemsByEmail.has(item.email_id)) {
        actionItemsByEmail.set(item.email_id, []);
      }
      actionItemsByEmail.get(item.email_id)!.push({
        id: item.id,
        title: item.title,
        type: item.type,
      });
    }

    // Check which emails have tasks
    const { data: tasksWithEmails } = await supabase
      .from("tasks")
      .select("source_email_id")
      .in("source_email_id", emailIds);

    const emailsWithTasks = new Set(tasksWithEmails?.map(t => t.source_email_id) || []);

    // Get client names for matched clients
    const clientIds = emails.filter(e => e.matched_client_id).map(e => e.matched_client_id);
    const { data: clients } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .in("id", clientIds);

    const clientMap = new Map(clients?.map(c => [c.id, `${c.first_name} ${c.last_name}`]) || []);

    // Transform to InboxItem format
    const items: InboxItem[] = emails.map(email => ({
      id: email.id,
      emailId: email.email_id,
      accountId: email.account_id,
      accountEmail: accountEmailMap.get(email.account_id) || email.account_id,
      from: {
        name: email.from_name || "",
        email: email.from_email || "",
      },
      subject: email.subject || "(No Subject)",
      summary: email.summary,
      bodyPreview: email.body_preview,
      category: email.category || "other",
      priority: email.priority || "medium",
      sentiment: email.sentiment,
      requiresResponse: email.requires_response || false,
      hasAttachments: email.has_attachments || false,
      receivedAt: email.created_at,
      status: email.status || "pending",
      hasTask: emailsWithTasks.has(email.email_id),
      matchedClientId: email.matched_client_id,
      matchedClientName: email.matched_client_id ? clientMap.get(email.matched_client_id) || null : null,
      actionItems: actionItemsByEmail.get(email.email_id) || [],
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
