import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/clients/[id]/communications
 *
 * Get all communications (calls + emails) for a specific client
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // 'call', 'email', or null for all
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  try {
    // Fetch calls for this client
    let callsData: {
      id: string;
      created_at: string;
      direction: string;
      caller_phone: string | null;
      caller_name: string | null;
      summary: string | null;
      duration: number | null;
      recording_url: string | null;
      transcription: string | null;
      sentiment: string | null;
      intent: string | null;
    }[] = [];

    if (!type || type === "call") {
      const { data: calls, error: callsError } = await supabase
        .from("calls")
        .select(
          `
          id,
          created_at,
          direction,
          caller_phone,
          caller_name,
          summary,
          duration,
          recording_url,
          transcription,
          sentiment,
          intent
        `
        )
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (callsError) {
        console.error("Error fetching calls:", callsError);
      } else {
        callsData = calls || [];
      }
    }

    // Fetch email classifications for this client
    let emailsData: {
      id: string;
      created_at: string;
      email_message_id: string;
      summary: string | null;
      category: string | null;
      sentiment: string | null;
      priority_score: number | null;
      is_business_relevant: boolean;
      urgency: string | null;
      key_points: string[] | null;
    }[] = [];

    if (!type || type === "email") {
      const { data: emails, error: emailsError } = await supabase
        .from("email_classifications")
        .select(
          `
          id,
          created_at,
          email_message_id,
          summary,
          category,
          sentiment,
          priority_score,
          is_business_relevant,
          urgency,
          key_points
        `
        )
        .eq("client_id", id)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (emailsError) {
        console.error("Error fetching emails:", emailsError);
      } else {
        emailsData = emails || [];
      }
    }

    // Combine and sort by created_at
    const communications = [
      ...callsData.map((call) => ({
        type: "call" as const,
        id: call.id,
        createdAt: call.created_at,
        direction: call.direction,
        contactInfo: call.caller_phone,
        contactName: call.caller_name,
        summary: call.summary,
        duration: call.duration,
        recordingUrl: call.recording_url,
        content: call.transcription,
        sentiment: call.sentiment,
        category: call.intent,
      })),
      ...emailsData.map((email) => ({
        type: "email" as const,
        id: email.id,
        createdAt: email.created_at,
        direction: "inbound" as const,
        contactInfo: null,
        contactName: null,
        summary: email.summary,
        duration: null,
        recordingUrl: null,
        content: null,
        sentiment: email.sentiment,
        category: email.category,
        messageId: email.email_message_id,
        priorityScore: email.priority_score,
        keyPoints: email.key_points,
      })),
    ].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Get total counts
    const { count: callsCount } = await supabase
      .from("calls")
      .select("*", { count: "exact", head: true })
      .eq("client_id", id);

    const { count: emailsCount } = await supabase
      .from("email_classifications")
      .select("*", { count: "exact", head: true })
      .eq("client_id", id);

    return NextResponse.json({
      communications: communications.slice(0, limit),
      stats: {
        totalCalls: callsCount || 0,
        totalEmails: emailsCount || 0,
        total: (callsCount || 0) + (emailsCount || 0),
      },
      pagination: {
        limit,
        offset,
        hasMore: communications.length > limit,
      },
    });
  } catch (error) {
    console.error("Error fetching client communications:", error);
    return NextResponse.json(
      { error: "Failed to fetch communications" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/clients/[id]/communications
 *
 * Link an existing call or email to this client
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, recordId } = body as {
      type: "call" | "email";
      recordId: string;
    };

    if (!type || !recordId) {
      return NextResponse.json(
        { error: "Missing type or recordId" },
        { status: 400 }
      );
    }

    if (type === "call") {
      const { error } = await supabase
        .from("calls")
        .update({ client_id: id })
        .eq("id", recordId);

      if (error) throw error;
    } else if (type === "email") {
      const { error } = await supabase
        .from("email_classifications")
        .update({
          client_id: id,
          matched_at: new Date().toISOString(),
          match_method: "manual",
        })
        .eq("id", recordId);

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      message: `${type} linked to client successfully`,
    });
  } catch (error) {
    console.error("Error linking communication to client:", error);
    return NextResponse.json(
      { error: "Failed to link communication" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/clients/[id]/communications
 *
 * Unlink a call or email from this client
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") as "call" | "email" | null;
    const recordId = searchParams.get("recordId");

    if (!type || !recordId) {
      return NextResponse.json(
        { error: "Missing type or recordId" },
        { status: 400 }
      );
    }

    if (type === "call") {
      const { error } = await supabase
        .from("calls")
        .update({ client_id: null })
        .eq("id", recordId)
        .eq("client_id", id);

      if (error) throw error;
    } else if (type === "email") {
      const { error } = await supabase
        .from("email_classifications")
        .update({
          client_id: null,
          matched_at: null,
          match_method: null,
        })
        .eq("id", recordId)
        .eq("client_id", id);

      if (error) throw error;
    }

    return NextResponse.json({
      success: true,
      message: `${type} unlinked from client successfully`,
    });
  } catch (error) {
    console.error("Error unlinking communication from client:", error);
    return NextResponse.json(
      { error: "Failed to unlink communication" },
      { status: 500 }
    );
  }
}
