import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { subDays, format, startOfDay, eachDayOfInterval } from "date-fns";

// GET - Get SMS analytics
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30");

  try {
    const startDate = subDays(new Date(), days);
    const startDateStr = startDate.toISOString();

    // Get message counts
    const { count: totalOutbound } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound")
      .gte("created_at", startDateStr);

    const { count: totalInbound } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "inbound")
      .gte("created_at", startDateStr);

    const { count: totalDelivered } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "delivered")
      .gte("created_at", startDateStr);

    const { count: totalFailed } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "failed")
      .gte("created_at", startDateStr);

    // Get active conversations (with activity in the period)
    const { count: activeConversations } = await supabase
      .from("sms_conversations")
      .select("*", { count: "exact", head: true })
      .gte("last_message_at", startDateStr);

    // Get opt-out count
    const { count: optOutCount } = await supabase
      .from("sms_opt_out_log")
      .select("*", { count: "exact", head: true })
      .eq("action", "opt_out")
      .gte("created_at", startDateStr);

    // Get messages for daily stats and response time calculation
    const { data: allMessages } = await supabase
      .from("sms_messages")
      .select("id, direction, status, conversation_id, created_at")
      .gte("created_at", startDateStr)
      .order("created_at", { ascending: true });

    // Calculate daily stats
    const dailyStatsMap: Record<string, { inbound: number; outbound: number; delivered: number; failed: number }> = {};

    // Initialize all days in the range
    const dateRange = eachDayOfInterval({ start: startDate, end: new Date() });
    dateRange.forEach(date => {
      const dateKey = format(date, "yyyy-MM-dd");
      dailyStatsMap[dateKey] = { inbound: 0, outbound: 0, delivered: 0, failed: 0 };
    });

    // Populate with actual data
    allMessages?.forEach(msg => {
      const dateKey = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (dailyStatsMap[dateKey]) {
        if (msg.direction === "outbound") {
          dailyStatsMap[dateKey].outbound++;
          if (msg.status === "delivered") {
            dailyStatsMap[dateKey].delivered++;
          } else if (msg.status === "failed") {
            dailyStatsMap[dateKey].failed++;
          }
        } else {
          dailyStatsMap[dateKey].inbound++;
        }
      }
    });

    const dailyStats = Object.entries(dailyStatsMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));

    // Calculate response rate (conversations that got a reply)
    const conversationsWithInbound = new Set<string>();
    const conversationsWithReply = new Set<string>();

    allMessages?.forEach(msg => {
      if (msg.direction === "inbound") {
        conversationsWithInbound.add(msg.conversation_id);
      }
    });

    allMessages?.forEach(msg => {
      if (msg.direction === "outbound" && conversationsWithInbound.has(msg.conversation_id)) {
        conversationsWithReply.add(msg.conversation_id);
      }
    });

    const responseRate = conversationsWithInbound.size > 0
      ? conversationsWithReply.size / conversationsWithInbound.size
      : 0;

    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;

    const messagesByConversation: Record<string, typeof allMessages> = {};
    allMessages?.forEach(msg => {
      if (!messagesByConversation[msg.conversation_id]) {
        messagesByConversation[msg.conversation_id] = [];
      }
      messagesByConversation[msg.conversation_id]!.push(msg);
    });

    Object.values(messagesByConversation).forEach(messages => {
      messages?.forEach((msg, idx) => {
        if (msg.direction === "inbound") {
          // Find next outbound message
          const nextOutbound = messages?.slice(idx + 1).find(m => m.direction === "outbound");
          if (nextOutbound) {
            const responseTime = new Date(nextOutbound.created_at).getTime() - new Date(msg.created_at).getTime();
            if (responseTime > 0 && responseTime < 86400000) { // Less than 24 hours
              totalResponseTime += responseTime;
              responseCount++;
            }
          }
        }
      });
    });

    const avgResponseTime = responseCount > 0
      ? totalResponseTime / responseCount / 1000 // in seconds
      : 0;

    // Get top contacts by message count
    const contactMessageCounts: Record<string, { contact_id: string; count: number }> = {};

    const { data: messagesWithContacts } = await supabase
      .from("sms_messages")
      .select(`
        conversation_id,
        sms_conversations!inner (
          contact_id,
          contact:client_contacts!contact_id (
            id,
            first_name,
            last_name
          )
        )
      `)
      .gte("created_at", startDateStr);

    messagesWithContacts?.forEach((msg: any) => {
      const contactId = msg.sms_conversations?.contact_id;
      if (contactId) {
        if (!contactMessageCounts[contactId]) {
          contactMessageCounts[contactId] = { contact_id: contactId, count: 0 };
        }
        contactMessageCounts[contactId].count++;
      }
    });

    // Get contact names for top contacts
    const topContactIds = Object.values(contactMessageCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(c => c.contact_id);

    const { data: contactDetails } = await supabase
      .from("client_contacts")
      .select("id, first_name, last_name")
      .in("id", topContactIds);

    const topContacts = Object.values(contactMessageCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(c => {
        const contact = contactDetails?.find(cd => cd.id === c.contact_id);
        return {
          contact_id: c.contact_id,
          contact_name: contact ? `${contact.first_name} ${contact.last_name}` : "Unknown",
          message_count: c.count,
        };
      });

    return NextResponse.json({
      totalMessages: (totalOutbound || 0) + (totalInbound || 0),
      totalInbound: totalInbound || 0,
      totalOutbound: totalOutbound || 0,
      totalDelivered: totalDelivered || 0,
      totalFailed: totalFailed || 0,
      responseRate,
      avgResponseTime,
      activeConversations: activeConversations || 0,
      optOutCount: optOutCount || 0,
      dailyStats,
      topContacts,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
