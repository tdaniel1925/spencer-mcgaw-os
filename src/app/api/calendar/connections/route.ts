import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all calendar connections for the current user
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: connections, error } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching calendar connections:", error);
      return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
    }

    // Also check for Microsoft connection in email_connections (legacy support)
    const { data: emailConnections } = await supabase
      .from("email_connections")
      .select("id, provider, email, access_token, created_at")
      .eq("user_id", user.id)
      .eq("provider", "microsoft");

    // Convert email_connections to calendar format for Microsoft
    const msConnections = (emailConnections || []).map(conn => ({
      id: conn.id,
      provider: "microsoft" as const,
      email: conn.email,
      sync_enabled: true,
      last_sync_at: null,
      created_at: conn.created_at,
      // Flag this as coming from email_connections
      _source: "email_connections"
    }));

    // Merge connections, avoiding duplicates
    const allConnections = [...(connections || [])];
    for (const ms of msConnections) {
      const exists = allConnections.some(c => c.provider === "microsoft" && c.email === ms.email);
      if (!exists) {
        allConnections.push(ms);
      }
    }

    return NextResponse.json({ connections: allConnections });
  } catch (error) {
    console.error("Error fetching calendar connections:", error);
    return NextResponse.json({ error: "Failed to fetch connections" }, { status: 500 });
  }
}

// DELETE - Remove a calendar connection
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const connectionId = searchParams.get("id");

    if (!connectionId) {
      return NextResponse.json({ error: "Connection ID required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("calendar_connections")
      .delete()
      .eq("id", connectionId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting connection:", error);
      return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting connection:", error);
    return NextResponse.json({ error: "Failed to delete connection" }, { status: 500 });
  }
}
