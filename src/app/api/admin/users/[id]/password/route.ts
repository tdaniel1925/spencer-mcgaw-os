import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";

/**
 * POST /api/admin/users/[id]/password
 * Change a user's password (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { password } = body;

    if (!password || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify requester is admin
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if requester has admin permissions
    const { data: requester } = await supabase
      .from("user_profiles")
      .select("role")
      .eq("id", authUser.id)
      .single();

    if (!requester || !["owner", "admin"].includes(requester.role)) {
      return NextResponse.json(
        { error: "You do not have permission to perform this action" },
        { status: 403 }
      );
    }

    // Prevent changing own password through this endpoint (use profile settings instead)
    if (id === authUser.id) {
      return NextResponse.json(
        { error: "Use your profile settings to change your own password" },
        { status: 400 }
      );
    }

    // Get target user info for logging
    const { data: targetUser } = await supabase
      .from("user_profiles")
      .select("id, email, full_name")
      .eq("id", id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Update the user's password using admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      id,
      { password }
    );

    if (updateError) {
      logger.error("[Admin] Failed to update user password", updateError);
      return NextResponse.json(
        { error: "Failed to update password" },
        { status: 500 }
      );
    }

    logger.info(`[Admin] Password changed for user ${targetUser.email} by ${authUser.id}`);

    // Log to activity feed
    await supabase.from("activity_log").insert({
      user_id: authUser.id,
      action: "changed user password",
      resource_type: "user",
      resource_id: targetUser.id,
      resource_name: targetUser.email,
      details: { target_user_name: targetUser.full_name },
    });

    return NextResponse.json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    logger.error("[Admin] Password change failed", error);
    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}
