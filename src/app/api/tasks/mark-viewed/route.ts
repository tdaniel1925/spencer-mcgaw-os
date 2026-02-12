import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";

/**
 * POST /api/tasks/mark-viewed
 * Marks all unopened tasks for the current user as viewed
 * Sets first_viewed_at to current timestamp for tasks where it's NULL
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      logger.error("Unauthorized: No user found", { error: authError });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Mark all unopened tasks as viewed
    const { data, error } = await supabase
      .from("tasks")
      .update({ first_viewed_at: new Date().toISOString() })
      .eq("assigned_to", user.id)
      .is("first_viewed_at", null)
      .select();

    if (error) {
      logger.error("Failed to mark tasks as viewed", {
        error,
        userId: user.id,
      });
      return NextResponse.json(
        { error: "Failed to mark tasks as viewed" },
        { status: 500 }
      );
    }

    const count = data?.length || 0;

    logger.info("Tasks marked as viewed", {
      userId: user.id,
      count,
    });

    return NextResponse.json({
      success: true,
      count,
      message: `${count} task(s) marked as viewed`,
    });
  } catch (error) {
    logger.error("Error in mark-viewed endpoint", { error });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
