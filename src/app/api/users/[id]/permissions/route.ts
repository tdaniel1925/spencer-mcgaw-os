import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type {
  PermissionOverride,
  CreatePermissionOverride,
  UpdatePermissionOverride,
} from "@/lib/types/permissions";

// GET - Get all permission overrides for a user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user can view permissions (self or admin)
    const { data: currentUser } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const isAdmin = currentUser?.role === "owner" || currentUser?.role === "admin";
    const isSelf = user.id === targetUserId;

    if (!isAdmin && !isSelf) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Get permission overrides
    const { data: overrides, error } = await supabase
      .from("user_permission_overrides")
      .select(`
        *,
        granted_by_user:granted_by(id, full_name, email)
      `)
      .eq("user_id", targetUserId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching permission overrides:", error);
      return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
    }

    return NextResponse.json({ overrides: overrides || [] });
  } catch (error) {
    console.error("Error in GET /api/users/[id]/permissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Create a new permission override
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can modify permissions
    const { data: currentUser } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (currentUser?.role !== "owner" && currentUser?.role !== "admin") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const body: CreatePermissionOverride = await request.json();

    // Validate required fields
    if (!body.permission || typeof body.granted !== "boolean") {
      return NextResponse.json(
        { error: "permission and granted are required" },
        { status: 400 }
      );
    }

    // Upsert the permission override
    const { data: override, error } = await supabase
      .from("user_permission_overrides")
      .upsert(
        {
          user_id: targetUserId,
          permission: body.permission,
          granted: body.granted,
          granted_by: user.id,
          reason: body.reason || null,
          expires_at: body.expires_at || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id,permission",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error creating permission override:", error);
      return NextResponse.json({ error: "Failed to create permission override" }, { status: 500 });
    }

    return NextResponse.json({ override });
  } catch (error) {
    console.error("Error in POST /api/users/[id]/permissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Remove a permission override
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetUserId } = await params;
  const supabase = await createClient();

  try {
    // Get current user
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can modify permissions
    const { data: currentUser } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (currentUser?.role !== "owner" && currentUser?.role !== "admin") {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const permission = searchParams.get("permission");

    if (!permission) {
      return NextResponse.json({ error: "permission query param required" }, { status: 400 });
    }

    const { error } = await supabase
      .from("user_permission_overrides")
      .delete()
      .eq("user_id", targetUserId)
      .eq("permission", permission);

    if (error) {
      console.error("Error deleting permission override:", error);
      return NextResponse.json({ error: "Failed to delete permission override" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/users/[id]/permissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
