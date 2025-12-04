import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get all email connections for this user
  const { data: connections, error } = await supabase
    .from("email_connections")
    .select("id, provider, email, display_name, expires_at, updated_at, scopes")
    .eq("user_id", user.id);

  if (error) {
    console.error("Error fetching email connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch email connections" },
      { status: 500 }
    );
  }

  // Transform to ConnectedEmailAccount format
  const accounts = (connections || []).map((conn) => ({
    id: conn.id,
    email: conn.email,
    displayName: conn.display_name || conn.email,
    provider: conn.provider,
    isConnected: new Date(conn.expires_at) > new Date(),
    lastSyncAt: conn.updated_at ? new Date(conn.updated_at) : null,
    syncStatus: "idle" as const,
    settings: {
      autoSync: true,
      syncIntervalMinutes: 5,
      syncFolders: ["inbox", "sent"],
      aiFilterEnabled: true,
      aiAutoClassify: true,
      aiAutoPrioritize: true,
    },
  }));

  return NextResponse.json({ accounts });
}
