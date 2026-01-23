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
  // Validate and constrain pagination params
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "50", 10) || 50, 1), 200);
  const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

  try {
    const feedItems: OrgFeedItem[] = [];
    let totalCallCount = 0;
    let totalEmailCount = 0;

    // Fetch calls if type is 'all' or 'calls'
    if (type === "all" || type === "calls") {
      try {
        // Get actual count from database
        const countResult = await db
          .select({ count: sql<number>`count(*)` })
          .from(calls);
        totalCallCount = Number(countResult[0]?.count || 0);

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
          .limit(type === "calls" ? limit : limit + offset) // Fetch extra rows when merging with emails
          .offset(type === "calls" ? offset : 0); // Only apply offset when showing calls only

        // Check which calls have tasks (only query if we have call IDs)
        const callIds = callsData.map(c => c.id);
        let callsWithTasks = new Set<string>();
        if (callIds.length > 0) {
          const { data: tasksWithCalls } = await supabase
            .from("tasks")
            .select("source_call_id")
            .in("source_call_id", callIds);
          callsWithTasks = new Set(tasksWithCalls?.map(t => t.source_call_id) || []);
        }

        // Get client names for matched clients (only query if we have client IDs)
        const clientIds = callsData.filter(c => c.clientId).map(c => c.clientId) as string[];
        let clientMap = new Map<string, string>();
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, first_name, last_name")
            .in("id", clientIds);
          clientMap = new Map(clients?.map(c => [c.id, `${c.first_name} ${c.last_name}`]) || []);
        }

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
      } catch (callsError) {
        // If calls table doesn't exist or query fails, continue with 0 calls
        console.error("[Org Feed API] Calls query error:", callsError);
        totalCallCount = 0;
      }
    }

    // Fetch email classifications if type is 'all' or 'emails'
    if (type === "all" || type === "emails") {
      // First, get account IDs that are marked as global (Org Feed routing)
      const { data: globalAccounts } = await supabase
        .from("email_connections")
        .select("id")
        .eq("is_global", true);

      const globalAccountIds = globalAccounts?.map(a => a.id) || [];

      // Get count of emails from global accounts only
      if (globalAccountIds.length > 0) {
        const { count: emailCountResult } = await supabase
          .from("email_classifications")
          .select("*", { count: "exact", head: true })
          .in("account_id", globalAccountIds);
        totalEmailCount = emailCountResult || 0;
      } else {
        totalEmailCount = 0;
      }

      // Fetch emails only from global accounts (accounts routed to Org Feed)
      const { data: emailClassifications, error: emailError } = globalAccountIds.length > 0
        ? await supabase
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
            .in("account_id", globalAccountIds)
            .order("created_at", { ascending: false })
            .range(
              type === "emails" ? offset : 0,
              type === "emails" ? offset + limit - 1 : limit + offset - 1
            ) // Apply offset only when showing emails only
        : { data: [], error: null };

      if (!emailError && emailClassifications && emailClassifications.length > 0) {
        // Get action items for these emails
        const emailIds = emailClassifications.map(e => e.email_id);
        const actionItemsByEmail = new Map<string, Array<{ id: string; title: string; type: string }>>();

        if (emailIds.length > 0) {
          const { data: actionItems } = await supabase
            .from("email_action_items")
            .select("email_id, id, title, type")
            .in("email_id", emailIds);

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
        }

        // Check which emails have tasks
        let emailsWithTasks = new Set<string>();
        if (emailIds.length > 0) {
          const { data: tasksWithEmails } = await supabase
            .from("tasks")
            .select("source_email_id")
            .in("source_email_id", emailIds);
          emailsWithTasks = new Set(tasksWithEmails?.map(t => t.source_email_id) || []);
        }

        // Get client names (only if we have client IDs)
        const clientIds = emailClassifications.filter(e => e.matched_client_id).map(e => e.matched_client_id) as string[];
        let clientMap = new Map<string, string>();
        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, first_name, last_name")
            .in("id", clientIds);
          clientMap = new Map(clients?.map(c => [c.id, `${c.first_name} ${c.last_name}`]) || []);
        }

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

    // Apply offset and limit after combining (only needed when type="all", since single types already paginated at DB level)
    const paginatedItems = type === "all" ? feedItems.slice(offset, offset + limit) : feedItems;

    // Calculate total based on type filter
    const total = type === "calls" ? totalCallCount : type === "emails" ? totalEmailCount : totalCallCount + totalEmailCount;

    return NextResponse.json({
      items: paginatedItems,
      total,
      callCount: totalCallCount,
      emailCount: totalEmailCount,
      hasMore: offset + limit < total,
    });
  } catch (error) {
    console.error("[Org Feed API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch org feed" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/org-feed
 * Delete calls (admin only)
 * Query params:
 * - type: 'all' | 'calls' - what to delete
 * - olderThan: ISO date string - only delete items older than this date
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const deleteType = searchParams.get("type") || "calls";
  const olderThan = searchParams.get("olderThan");

  try {
    let deletedCount = 0;

    if (deleteType === "calls" || deleteType === "all") {
      // Get count before deleting
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(calls);
      const beforeCount = Number(countResult[0]?.count || 0);

      // Build delete query
      if (olderThan) {
        // Delete calls older than specified date
        await db
          .delete(calls)
          .where(sql`${calls.createdAt} < ${new Date(olderThan)}`);
      } else {
        // Delete all calls
        await db.delete(calls);
      }

      // Get count after deleting to calculate deleted
      const afterResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(calls);
      const afterCount = Number(afterResult[0]?.count || 0);
      deletedCount = beforeCount - afterCount;
    }

    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} call${deletedCount !== 1 ? 's' : ''}`,
    });
  } catch (error) {
    console.error("[Org Feed API] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete items" },
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
