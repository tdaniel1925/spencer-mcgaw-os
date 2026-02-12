/**
 * Recent Emails API - GET emails from database
 *
 * @route GET /api/emails/recent
 * @query limit - Number of emails to fetch (default: 10)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    // Fetch recent emails from database
    const { data: emails, error } = await supabase
      .from("email_messages")
      .select(
        `
        id,
        subject,
        from_email,
        from_name,
        body_preview,
        received_at,
        is_read,
        is_flagged,
        has_attachments,
        importance
      `
      )
      .eq("user_id", user.id)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (error) {
      logger.error("[API] Error fetching recent emails", { error });
      return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
    }

    return NextResponse.json({
      emails: emails || [],
      count: emails?.length || 0,
    });
  } catch (error) {
    logger.error("[API] Error in recent emails endpoint", { error });
    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
}
