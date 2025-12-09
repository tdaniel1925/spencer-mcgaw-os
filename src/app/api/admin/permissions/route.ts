import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hasPermission, UserRole, Permission } from "@/lib/permissions";

// GET - Get permission overrides for a user
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get current user's role to check permissions
  const { data: currentUserProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = currentUserProfile?.role as UserRole | undefined;

  // Check permission - must have users:manage_roles
  if (!hasPermission(userRole, "users:manage_roles")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "User ID is required" }, { status: 400 });
  }

  try {
    const { data: overrides, error } = await supabase
      .from("user_permission_overrides")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching permission overrides:", error);
      return NextResponse.json({ error: "Failed to fetch permission overrides" }, { status: 500 });
    }

    return NextResponse.json({ overrides: overrides || [] });
  } catch (error) {
    console.error("Error fetching permission overrides:", error);
    return NextResponse.json({ error: "Failed to fetch permission overrides" }, { status: 500 });
  }
}

// POST - Add a permission override
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get current user's role to check permissions
  const { data: currentUserProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = currentUserProfile?.role as UserRole | undefined;

  // Only owners can manage permission overrides
  if (userRole !== "owner") {
    return NextResponse.json({ error: "Only owners can manage permission overrides" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { user_id, permission, granted, reason, expires_at } = body;

    if (!user_id || !permission) {
      return NextResponse.json({ error: "User ID and permission are required" }, { status: 400 });
    }

    // Validate permission exists
    const validPermissions = [
      "dashboard:view", "dashboard:view_analytics", "dashboard:view_revenue",
      "tasks:view", "tasks:create", "tasks:edit", "tasks:delete", "tasks:assign", "tasks:view_all",
      "clients:view", "clients:create", "clients:edit", "clients:delete", "clients:view_sensitive", "clients:export",
      "calls:view", "calls:make", "calls:view_recordings", "calls:manage_agent",
      "email:view", "email:send", "email:manage_rules", "email:connect_accounts",
      "documents:view", "documents:upload", "documents:download", "documents:delete", "documents:manage_rules", "documents:view_all_clients",
      "analytics:view", "analytics:view_financial", "analytics:export",
      "calendar:view", "calendar:create", "calendar:edit", "calendar:view_all",
      "activity:view", "activity:view_all",
      "settings:view", "settings:edit_profile", "settings:manage_integrations", "settings:manage_billing",
      "users:view", "users:create", "users:edit", "users:delete", "users:manage_roles",
      "system:view_audit_logs", "system:manage_api_keys", "system:backup_restore",
    ];

    if (!validPermissions.includes(permission)) {
      return NextResponse.json({ error: "Invalid permission" }, { status: 400 });
    }

    // Upsert the override (update if exists, insert if not)
    const { data: override, error } = await supabase
      .from("user_permission_overrides")
      .upsert({
        user_id,
        permission,
        granted: granted !== false,
        granted_by: user.id,
        reason: reason || null,
        expires_at: expires_at || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "user_id,permission",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating permission override:", error);
      return NextResponse.json({ error: "Failed to create permission override" }, { status: 500 });
    }

    return NextResponse.json({ override });
  } catch (error) {
    console.error("Error creating permission override:", error);
    return NextResponse.json({ error: "Failed to create permission override" }, { status: 500 });
  }
}

// DELETE - Remove a permission override
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get current user's role to check permissions
  const { data: currentUserProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = currentUserProfile?.role as UserRole | undefined;

  // Only owners can manage permission overrides
  if (userRole !== "owner") {
    return NextResponse.json({ error: "Only owners can manage permission overrides" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const overrideId = searchParams.get("id");

  if (!overrideId) {
    return NextResponse.json({ error: "Override ID is required" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from("user_permission_overrides")
      .delete()
      .eq("id", overrideId);

    if (error) {
      console.error("Error deleting permission override:", error);
      return NextResponse.json({ error: "Failed to delete permission override" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting permission override:", error);
    return NextResponse.json({ error: "Failed to delete permission override" }, { status: 500 });
  }
}
