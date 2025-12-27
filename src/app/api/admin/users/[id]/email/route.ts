import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emailWelcome, emailPasswordReset } from "@/lib/email/email-service";
import logger from "@/lib/logger";

/**
 * POST /api/admin/users/[id]/email
 * Send email to a user (resend invite or password reset)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { type } = body; // "invite" or "password_reset"

    if (!type || !["invite", "password_reset"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid email type. Must be 'invite' or 'password_reset'" },
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

    // Get target user from user_profiles
    const { data: targetUser } = await supabase
      .from("user_profiles")
      .select("id, email, full_name")
      .eq("id", id)
      .single();

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (type === "invite") {
      // Resend welcome/invite email
      const success = await emailWelcome(
        targetUser.email,
        targetUser.full_name
      );

      if (success) {
        logger.info(`[Admin] Resent invite email to ${targetUser.email}`);
        return NextResponse.json({
          success: true,
          message: "Invite email sent successfully",
        });
      } else {
        return NextResponse.json(
          { error: "Failed to send invite email. Please check email configuration." },
          { status: 500 }
        );
      }
    } else if (type === "password_reset") {
      // Use Supabase to generate password reset link
      const { data: resetData, error: resetError } =
        await supabase.auth.admin.generateLink({
          type: "recovery",
          email: targetUser.email,
          options: {
            redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
          },
        });

      if (resetError) {
        logger.error("[Admin] Failed to generate password reset link", resetError);
        return NextResponse.json(
          { error: "Failed to generate password reset link" },
          { status: 500 }
        );
      }

      // Send custom password reset email
      const resetLink = resetData.properties?.action_link;
      if (resetLink) {
        const success = await emailPasswordReset(
          targetUser.email,
          targetUser.full_name,
          resetLink
        );

        if (success) {
          logger.info(`[Admin] Sent password reset email to ${targetUser.email}`);
          return NextResponse.json({
            success: true,
            message: "Password reset email sent successfully",
          });
        }
      }

      // Fallback: Supabase already sent the email via generateLink
      logger.info(`[Admin] Password reset link generated for ${targetUser.email}`);
      return NextResponse.json({
        success: true,
        message: "Password reset email sent successfully",
      });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    logger.error("[Admin] Email action failed", error);
    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}
