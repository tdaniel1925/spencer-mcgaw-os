/**
 * Email List API - GET emails from folders
 *
 * @route GET /api/emails
 * @query folder - Folder name (inbox, sent, drafts, trash, archive)
 * @query top - Number of emails to fetch (default: 50)
 * @query skip - Number of emails to skip for pagination (default: 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";

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
    const folder = searchParams.get("folder") || "inbox";
    const top = parseInt(searchParams.get("top") || "50", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);
    const orderBy = searchParams.get("orderBy") || "receivedDateTime desc";

    // Create Graph service
    const graphService = await GraphEmailService.fromConnection(user.id);
    if (!graphService) {
      return NextResponse.json(
        { error: "Email not connected", needsConnection: true },
        { status: 400 }
      );
    }

    // Fetch emails
    const result = await graphService.getEmails(folder, { top, skip, orderBy });

    return NextResponse.json({
      emails: result.emails,
      nextLink: result.nextLink,
      folder,
    });
  } catch (error: unknown) {
    console.error("[API] Error fetching emails:", error);

    if (error instanceof Error) {
      if (error.message.includes("TOKEN_EXPIRED")) {
        return NextResponse.json(
          { error: "Token expired, please reconnect", needsConnection: true },
          { status: 401 }
        );
      }
    }

    return NextResponse.json({ error: "Failed to fetch emails" }, { status: 500 });
  }
}
