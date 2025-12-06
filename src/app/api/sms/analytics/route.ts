import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get SMS analytics
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "7d"; // 7d, 30d, 90d
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  try {
    let dateFilter: Date;
    const now = new Date();

    if (startDate && endDate) {
      dateFilter = new Date(startDate);
    } else {
      switch (period) {
        case "30d":
          dateFilter = new Date(now.setDate(now.getDate() - 30));
          break;
        case "90d":
          dateFilter = new Date(now.setDate(now.getDate() - 90));
          break;
        default:
          dateFilter = new Date(now.setDate(now.getDate() - 7));
      }
    }

    // Get message counts
    const { data: sentMessages, count: sentCount } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound")
      .gte("created_at", dateFilter.toISOString());

    const { data: receivedMessages, count: receivedCount } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "inbound")
      .gte("created_at", dateFilter.toISOString());

    const { count: deliveredCount } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "delivered")
      .gte("created_at", dateFilter.toISOString());

    const { count: failedCount } = await supabase
      .from("sms_messages")
      .select("*", { count: "exact", head: true })
      .eq("direction", "outbound")
      .eq("status", "failed")
      .gte("created_at", dateFilter.toISOString());

    // Get unique contacts
    const { data: uniqueContacts } = await supabase
      .from("sms_messages")
      .select("contact_id")
      .gte("created_at", dateFilter.toISOString());

    const uniqueContactCount = new Set(uniqueContacts?.map(m => m.contact_id)).size;

    // Get opt-out/opt-in counts
    const { count: optOutCount } = await supabase
      .from("sms_opt_out_log")
      .select("*", { count: "exact", head: true })
      .eq("action", "opt_out")
      .gte("created_at", dateFilter.toISOString());

    const { count: optInCount } = await supabase
      .from("sms_opt_out_log")
      .select("*", { count: "exact", head: true })
      .eq("action", "opt_in")
      .gte("created_at", dateFilter.toISOString());

    // Get conversations with unread messages
    const { count: unreadConversations } = await supabase
      .from("sms_conversations")
      .select("*", { count: "exact", head: true })
      .gt("unread_count", 0);

    // Get active conversations (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { count: activeConversations } = await supabase
      .from("sms_conversations")
      .select("*", { count: "exact", head: true })
      .gte("last_message_at", weekAgo.toISOString());

    // Get messages by day for chart
    const { data: messagesByDay } = await supabase
      .from("sms_messages")
      .select("created_at, direction")
      .gte("created_at", dateFilter.toISOString())
      .order("created_at", { ascending: true });

    // Group messages by day
    const dailyStats: Record<string, { sent: number; received: number }> = {};
    messagesByDay?.forEach(msg => {
      const day = new Date(msg.created_at).toISOString().split("T")[0];
      if (!dailyStats[day]) {
        dailyStats[day] = { sent: 0, received: 0 };
      }
      if (msg.direction === "outbound") {
        dailyStats[day].sent++;
      } else {
        dailyStats[day].received++;
      }
    });

    // Get top templates
    const { data: topTemplates } = await supabase
      .from("sms_templates")
      .select("id, name, use_count")
      .order("use_count", { ascending: false })
      .limit(5);

    // Get response time (average time between inbound and next outbound)
    // This is a simplified calculation
    const { data: recentInbound } = await supabase
      .from("sms_messages")
      .select("conversation_id, created_at")
      .eq("direction", "inbound")
      .gte("created_at", dateFilter.toISOString())
      .order("created_at", { ascending: true })
      .limit(100);

    let totalResponseTime = 0;
    let responseCount = 0;

    for (const inMsg of recentInbound || []) {
      const { data: nextOutbound } = await supabase
        .from("sms_messages")
        .select("created_at")
        .eq("conversation_id", inMsg.conversation_id)
        .eq("direction", "outbound")
        .gt("created_at", inMsg.created_at)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      if (nextOutbound) {
        const responseTime =
          new Date(nextOutbound.created_at).getTime() -
          new Date(inMsg.created_at).getTime();
        totalResponseTime += responseTime;
        responseCount++;
      }
    }

    const avgResponseTimeMinutes = responseCount > 0
      ? Math.round(totalResponseTime / responseCount / 60000)
      : 0;

    return NextResponse.json({
      overview: {
        totalSent: sentCount || 0,
        totalReceived: receivedCount || 0,
        totalDelivered: deliveredCount || 0,
        totalFailed: failedCount || 0,
        uniqueContacts: uniqueContactCount,
        optOuts: optOutCount || 0,
        optIns: optInCount || 0,
        unreadConversations: unreadConversations || 0,
        activeConversations: activeConversations || 0,
        deliveryRate: sentCount ? Math.round(((deliveredCount || 0) / sentCount) * 100) : 0,
        avgResponseTimeMinutes,
      },
      dailyStats: Object.entries(dailyStats).map(([date, stats]) => ({
        date,
        ...stats,
      })),
      topTemplates,
      period,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
