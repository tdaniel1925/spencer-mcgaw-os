import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { emailMessages, userProfiles } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * DELETE /api/email/messages/[id]
 * Soft delete an email message (marks as deleted)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: messageId } = await params;

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the email message
    const message = await db
      .select({
        userId: emailMessages.userId,
        isDeleted: emailMessages.isDeleted,
      })
      .from(emailMessages)
      .where(eq(emailMessages.id, messageId))
      .limit(1);

    if (!message || message.length === 0) {
      logger.warn("[Email Delete] Message not found", { messageId });
      return NextResponse.json(
        { error: "Email message not found" },
        { status: 404 }
      );
    }

    const emailData = message[0];

    // Check if already deleted
    if (emailData.isDeleted) {
      return NextResponse.json(
        { error: "Email already deleted" },
        { status: 410 }
      );
    }

    // Check permission (user owns it, or it's unassigned, or user is admin)
    const isOwner = emailData.userId === user.id;
    const isUnassigned = emailData.userId === null;

    // Check if admin
    const profile = await db
      .select({ role: userProfiles.role })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1);

    const isAdmin = profile?.[0]?.role === "admin";

    if (!isOwner && !isAdmin && !isUnassigned) {
      return NextResponse.json(
        { error: "Forbidden - you can only delete your own emails" },
        { status: 403 }
      );
    }

    // Soft delete the email message
    await db
      .update(emailMessages)
      .set({
        isDeleted: true,
        updatedAt: new Date(),
      })
      .where(eq(emailMessages.id, messageId));

    logger.info("[Email Delete] Email soft deleted successfully", {
      messageId,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[Email Delete] Unexpected error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
