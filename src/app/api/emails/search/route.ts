/**
 * Email Search API
 *
 * @route GET /api/emails/search
 * @query q - Search query
 * @query folder - Optional folder to search in
 * @query top - Number of results (default: 50)
 * @query skip - Pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 });
    }

    const folder = searchParams.get("folder") || undefined;
    const top = parseInt(searchParams.get("top") || "50", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    const graphService = await GraphEmailService.fromConnection(user.id);
    if (!graphService) {
      return NextResponse.json(
        { error: "Email not connected", needsConnection: true },
        { status: 400 }
      );
    }

    const result = await graphService.searchEmails({ query, folder, top, skip });

    return NextResponse.json({
      emails: result.emails,
      nextLink: result.nextLink,
      query,
    });
  } catch (error) {
    console.error("[API] Error searching emails:", error);
    return NextResponse.json({ error: "Failed to search emails" }, { status: 500 });
  }
}
