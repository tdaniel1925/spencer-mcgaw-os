import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get activity timeline for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Fetch notes
    const { data: notes } = await supabase
      .from("client_notes")
      .select("id, note_type, subject, content, user_id, created_at")
      .eq("client_id", clientId)
      .or(`is_private.eq.false,user_id.eq.${user.id}`)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Fetch communications
    const { data: communications } = await supabase
      .from("client_communications")
      .select("id, communication_type, subject, summary, user_id, created_at")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(limit);

    // Fetch recent service changes
    const { data: services } = await supabase
      .from("client_services")
      .select("id, service_name, status, created_at, updated_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    // Fetch tax filing updates
    const { data: filings } = await supabase
      .from("client_tax_filings")
      .select("id, filing_type, tax_year, status, filed_date, created_at, updated_at")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false })
      .limit(limit);

    // Get user info for all activities
    const userIds = [
      ...new Set([
        ...(notes?.map(n => n.user_id) || []),
        ...(communications?.map(c => c.user_id) || []),
      ].filter(Boolean))
    ];

    let usersMap: Record<string, { full_name: string; avatar_url: string }> = {};

    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      usersMap = (users || []).reduce((acc, u) => {
        acc[u.id] = { full_name: u.full_name, avatar_url: u.avatar_url };
        return acc;
      }, {} as Record<string, { full_name: string; avatar_url: string }>);
    }

    // Combine and format activities
    const activities: Array<{
      id: string;
      type: string;
      title: string;
      description?: string;
      user?: { full_name: string; avatar_url: string };
      timestamp: string;
      metadata?: Record<string, unknown>;
    }> = [];

    // Add notes
    notes?.forEach(note => {
      activities.push({
        id: `note-${note.id}`,
        type: note.note_type === "call" ? "call" : note.note_type === "meeting" ? "meeting" : "note",
        title: note.subject || `${note.note_type} note`,
        description: note.content.substring(0, 150) + (note.content.length > 150 ? "..." : ""),
        user: usersMap[note.user_id],
        timestamp: note.created_at,
        metadata: { noteId: note.id, noteType: note.note_type },
      });
    });

    // Add communications
    communications?.forEach(comm => {
      activities.push({
        id: `comm-${comm.id}`,
        type: comm.communication_type,
        title: comm.subject || `${comm.communication_type.replace("_", " ")}`,
        description: comm.summary,
        user: usersMap[comm.user_id],
        timestamp: comm.created_at,
        metadata: { commId: comm.id },
      });
    });

    // Add service updates
    services?.forEach(service => {
      activities.push({
        id: `service-${service.id}`,
        type: "service",
        title: `Service: ${service.service_name}`,
        description: `Status: ${service.status}`,
        timestamp: service.updated_at || service.created_at,
        metadata: { serviceId: service.id, status: service.status },
      });
    });

    // Add filing updates
    filings?.forEach(filing => {
      activities.push({
        id: `filing-${filing.id}`,
        type: "tax_filing",
        title: `${filing.filing_type} - ${filing.tax_year}`,
        description: `Status: ${filing.status}${filing.filed_date ? ` | Filed: ${filing.filed_date}` : ""}`,
        timestamp: filing.updated_at || filing.created_at,
        metadata: { filingId: filing.id, status: filing.status },
      });
    });

    // Sort by timestamp descending
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Limit total results
    const limitedActivities = activities.slice(0, limit);

    return NextResponse.json({ activities: limitedActivities });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
