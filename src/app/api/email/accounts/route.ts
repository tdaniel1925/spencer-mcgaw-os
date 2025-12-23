import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const includeGlobal = searchParams.get("includeGlobal") === "true";
  const onlyGlobal = searchParams.get("onlyGlobal") === "true";
  const allAccounts = searchParams.get("all") === "true"; // Admin only - list all accounts

  // Check if user is admin for "all" query
  let isAdmin = false;
  if (allAccounts) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.role === "admin";
  }

  // Build query based on params
  let query = supabase
    .from("email_connections")
    .select("id, provider, email, display_name, expires_at, updated_at, scopes, is_global, description, display_order, user_id");

  if (allAccounts && isAdmin) {
    // Admin can see all accounts
    // No filter needed
  } else if (onlyGlobal) {
    // Only global accounts
    query = query.eq("is_global", true);
  } else if (includeGlobal) {
    // User's accounts + global accounts
    query = query.or(`user_id.eq.${user.id},is_global.eq.true`);
  } else {
    // Only user's accounts (default)
    query = query.eq("user_id", user.id);
  }

  query = query.order("display_order", { ascending: true });

  const { data: connections, error } = await query;

  if (error) {
    console.error("Error fetching email connections:", error);
    return NextResponse.json(
      { error: "Failed to fetch email connections" },
      { status: 500 }
    );
  }

  // Get user info for admin view
  let userMap = new Map<string, string>();
  if (allAccounts && isAdmin && connections?.length) {
    const userIds = [...new Set(connections.map(c => c.user_id))];
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    userMap = new Map(profiles?.map(p => [p.id, p.full_name || p.email]) || []);
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
    isGlobal: conn.is_global || false,
    description: conn.description || null,
    displayOrder: conn.display_order || 0,
    isOwner: conn.user_id === user.id,
    ownerName: allAccounts ? userMap.get(conn.user_id) || null : null,
    settings: {
      autoSync: true,
      syncIntervalMinutes: 5,
      syncFolders: ["inbox", "sent"],
      aiFilterEnabled: true,
      aiAutoClassify: true,
      aiAutoPrioritize: true,
    },
  }));

  // Separate personal and global accounts for easier frontend handling
  const personalAccounts = accounts.filter(a => !a.isGlobal && a.isOwner);
  const globalAccounts = accounts.filter(a => a.isGlobal);

  return NextResponse.json({
    accounts,
    personalAccounts,
    globalAccounts,
  });
}
