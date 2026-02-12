import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { calls, userProfiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * DELETE /api/calls/[id]
 * Delete a phone call record
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: callId } = await params;

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the call record
    const call = await db
      .select({
        userId: calls.userId,
      })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);

    if (!call || call.length === 0) {
      logger.warn("[Call Delete] Call not found", { callId });
      return NextResponse.json(
        { error: "Call record not found" },
        { status: 404 }
      );
    }

    const callData = call[0];

    // Check permission (user owns it or is admin)
    const isOwner = callData.userId === user.id;

    // Check if admin
    const profile = await db
      .select({ role: userProfiles.role })
      .from(userProfiles)
      .where(eq(userProfiles.id, user.id))
      .limit(1);

    const isAdmin = profile?.[0]?.role === "admin";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - you can only delete your own call records" },
        { status: 403 }
      );
    }

    // Delete the call record
    await db.delete(calls).where(eq(calls.id, callId));

    logger.info("[Call Delete] Call deleted successfully", {
      callId,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[Call Delete] Unexpected error", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
