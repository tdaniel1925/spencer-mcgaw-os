import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export interface OrgFeedItem {
  id: string;
  type: "call" | "email";
  timestamp: string;
  // Common fields
  summary: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  // Source info
  from: {
    name: string | null;
    identifier: string; // phone or email
  };
  // Status
  hasTask: boolean;
  // Type-specific data
  callData?: {
    duration: number | null;
    status: string;
    direction: string;
    recordingUrl: string | null;
    category: string | null;
    sentiment: string | null;
    actionItems: string[];
  };
  emailData?: {
    subject: string;
    accountEmail: string;
    category: string;
    requiresResponse: boolean;
    actionItems: Array<{
      id: string;
      title: string;
      type: string;
    }>;
  };
  // Client matching
  matchedClientId: string | null;
  matchedClientName: string | null;
}

/**
 * GET /api/org-feed
 * Returns combined feed of calls and global emails
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "all"; // 'all', 'calls', 'emails'
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    const feedItems: OrgFeedItem[] = [];

    // Fetch calls if type is 'all' or 'calls'
    if (type === "all" || type === "calls") {
      const callsData = await db
        .select({
          id: calls.id,
          callerPhone: calls.callerPhone,
          callerName: calls.callerName,
          status: calls.status,
          direction: calls.direction,
          duration: calls.duration,
          summary: calls.summary,
          intent: calls.intent,
          sentiment: calls.sentiment,
          recordingUrl: calls.recordingUrl,
          metadata: calls.metadata,
          clientId: calls.clientId,
          createdAt: calls.createdAt,
        })
        .from(calls)
        .orderBy(desc(calls.createdAt))
        .limit(limit);

      // Check which calls have tasks
      const callIds = callsData.map(c => c.id);
      const { data: tasksWithCalls } = await supabase
        .from("tasks")
        .select("source_call_id")
        .in("source_call_id", callIds);

      const callsWithTasks = new Set(tasksWithCalls?.map(t => t.source_call_id) || []);

      // Get client names for matched clients
      const clientIds = callsData.filter(c => c.clientId).map(c => c.clientId);
      const { data: clients } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .in("id", clientIds);

      const clientMap = new Map(clients?.map(c => [c.id, `${c.first_name} ${c.last_name}`]) || []);

      for (const call of callsData) {
        const metadata = call.metadata as Record<string, unknown> | null;
        const actionItems = (metadata?.action_items as string[]) || [];

        feedItems.push({
          id: call.id,
          type: "call",
          timestamp: call.createdAt?.toISOString() || new Date().toISOString(),
          summary: call.summary,
          priority: determinePriority(call.intent, call.sentiment),
          from: {
            name: call.callerName,
            identifier: call.callerPhone || "Unknown",
          },
          hasTask: callsWithTasks.has(call.id),
          callData: {
            duration: call.duration,
            status: call.status,
            direction: call.direction,
            recordingUrl: call.recordingUrl,
            category: call.intent,
            sentiment: call.sentiment,
            actionItems,
          },
          matchedClientId: call.clientId,
          matchedClientName: call.clientId ? clientMap.get(call.clientId) || null : null,
        });
      }
    }

    // Fetch email classifications if type is 'all' or 'emails'
    if (type === "all" || type === "emails") {
      // Get global email accounts (where is_global = true)
      // For now, we'll fetch all email classifications since we haven't added the global flag yet
      const { data: emailClassifications, error: emailError } = await supabase
        .from("email_classifications")
        .select(`
          id,
          email_id,
          account_id,
          from_name,
          from_email,
          subject,
          summary,
          category,
          priority,
          sentiment,
          urgency,
          requires_response,
          matched_client_id,
          status,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (!emailError && emailClassifications) {
        // Get action items for these emails
        const emailIds = emailClassifications.map(e => e.email_id);
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

        // Get client names
        const clientIds = emailClassifications.filter(e => e.matched_client_id).map(e => e.matched_client_id);
        const { data: clients } = await supabase
          .from("clients")
          .select("id, first_name, last_name")
          .in("id", clientIds);

        const clientMap = new Map(clients?.map(c => [c.id, `${c.first_name} ${c.last_name}`]) || []);

        for (const email of emailClassifications) {
          feedItems.push({
            id: email.id,
            type: "email",
            timestamp: email.created_at,
            summary: email.summary,
            priority: email.priority || "medium",
            from: {
              name: email.from_name,
              identifier: email.from_email,
            },
            hasTask: emailsWithTasks.has(email.email_id),
            emailData: {
              subject: email.subject,
              accountEmail: email.account_id, // This would be the account email in real implementation
              category: email.category,
              requiresResponse: email.requires_response,
              actionItems: actionItemsByEmail.get(email.email_id) || [],
            },
            matchedClientId: email.matched_client_id,
            matchedClientName: email.matched_client_id ? clientMap.get(email.matched_client_id) || null : null,
          });
        }
      }
    }

    // Sort by timestamp descending
    feedItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply offset and limit after combining
    const paginatedItems = feedItems.slice(offset, offset + limit);

    return NextResponse.json({
      items: paginatedItems,
      total: feedItems.length,
      hasMore: offset + limit < feedItems.length,
    });
  } catch (error) {
    console.error("[Org Feed API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch org feed" },
      { status: 500 }
    );
  }
}

// Helper to determine priority from call intent/sentiment
function determinePriority(intent: string | null, sentiment: string | null): "low" | "medium" | "high" | "urgent" {
  if (intent === "urgent_matter" || intent === "complaint") return "urgent";
  if (sentiment === "negative") return "high";
  if (intent === "new_client_inquiry") return "medium";
  return "medium";
}
