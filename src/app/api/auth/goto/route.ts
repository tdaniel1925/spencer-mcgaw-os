import { NextResponse } from "next/server";
import { getAuthorizationUrl } from "@/lib/goto";

/**
 * GET /api/auth/goto
 *
 * Initiates GoTo Connect OAuth flow.
 * Redirects to GoTo's authorization page.
 */
export async function GET() {
  try {
    // Generate a state parameter for CSRF protection
    const state = Buffer.from(
      JSON.stringify({
        timestamp: Date.now(),
        random: Math.random().toString(36).substring(7),
      })
    ).toString("base64");

    const authUrl = getAuthorizationUrl(state);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("[GoTo Auth] Error initiating OAuth flow:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate GoTo Connect authorization",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
