import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasPermission, UserRole } from "@/lib/permissions";

// GET - Get single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Check permission - must have users:view
  if (!hasPermission(userRole, "users:view")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { data: userProfile, error } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching user:", error);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user: userProfile });
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Failed to fetch user" }, { status: 500 });
  }
}

// PATCH - Update user
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Check permission - must have users:edit
  if (!hasPermission(userRole, "users:edit")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { full_name, role, department, job_title, phone, is_active, show_in_taskpool } = body;

    // Get the target user's current role for role change validation
    const { data: targetUser } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", id)
      .single();

    const targetRole = targetUser?.role as UserRole | undefined;

    // Role change permission checks
    if (role !== undefined && role !== targetRole) {
      // Only owners can change to/from admin/owner roles
      if ((role === "owner" || role === "admin") && userRole !== "owner") {
        return NextResponse.json({
          error: "Only owners can assign admin or owner roles"
        }, { status: 403 });
      }

      // Only owners can change an admin/owner's role
      if ((targetRole === "owner" || targetRole === "admin") && userRole !== "owner") {
        return NextResponse.json({
          error: "Only owners can change admin or owner roles"
        }, { status: 403 });
      }

      // Only admins+ can assign manager role
      if (role === "manager" && userRole !== "owner" && userRole !== "admin") {
        return NextResponse.json({
          error: "Only admins can assign manager role"
        }, { status: 403 });
      }
    }

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (full_name !== undefined) updateData.full_name = full_name;
    if (role !== undefined) updateData.role = role;
    if (department !== undefined) updateData.department = department;
    if (job_title !== undefined) updateData.job_title = job_title;
    if (phone !== undefined) updateData.phone = phone;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (show_in_taskpool !== undefined) updateData.show_in_taskpool = show_in_taskpool;

    const { data: updatedUser, error } = await supabase
      .from("user_profiles")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Error updating user:", error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// DELETE - Delete user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  // Check permission - must have users:delete
  if (!hasPermission(userRole, "users:delete")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const { id } = await params;

  // Don't allow deleting yourself
  if (id === user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  try {
    // Get the target user's role to validate deletion permissions
    const { data: targetUser } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", id)
      .single();

    const targetRole = targetUser?.role as UserRole | undefined;

    // Only owners can delete admins/owners
    if ((targetRole === "owner" || targetRole === "admin") && userRole !== "owner") {
      return NextResponse.json({
        error: "Only owners can delete admin or owner accounts"
      }, { status: 403 });
    }

    // Can't delete owner accounts (there should always be at least one owner)
    if (targetRole === "owner") {
      return NextResponse.json({
        error: "Cannot delete owner accounts"
      }, { status: 403 });
    }

    const adminClient = createAdminClient();

    // Delete from Supabase Auth FIRST (safer order - prevents orphaned auth users)
    // If this fails, the profile remains intact and consistent
    try {
      const { error: authError } = await adminClient.auth.admin.deleteUser(id);
      if (authError) {
        console.error("Error deleting auth user:", authError);
        return NextResponse.json({ error: "Failed to delete user from authentication system" }, { status: 500 });
      }
    } catch (authError) {
      console.error("Error deleting auth user:", authError);
      return NextResponse.json({ error: "Failed to delete user from authentication system" }, { status: 500 });
    }

    // Now delete from user_profiles
    // Even if this fails, the user can't log in (auth is deleted)
    // The profile will be cleaned up by cascade or manually
    const { error: profileError } = await supabase
      .from("user_profiles")
      .delete()
      .eq("id", id);

    if (profileError) {
      console.error("Error deleting user profile (auth already deleted):", profileError);
      // Log but don't fail - auth user is deleted, which is the important part
    }

    return NextResponse.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}
