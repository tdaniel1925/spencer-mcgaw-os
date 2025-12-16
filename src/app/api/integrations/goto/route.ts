import { NextRequest, NextResponse } from "next/server";
import {
  isAuthenticated,
  getAccountKey,
  setupGoToIntegration,
  getAuthorizationUrl,
  getRecentCallReports,
} from "@/lib/goto";

/**
 * GET /api/integrations/goto
 *
 * Get GoTo Connect integration status
 */
export async function GET() {
  try {
    const authenticated = isAuthenticated();
    const accountKey = getAccountKey();

    // Get recent call stats if authenticated
    let recentCalls = 0;
    if (authenticated) {
      try {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const reports = await getRecentCallReports(oneDayAgo);
        recentCalls = reports.length;
      } catch {
        // Ignore errors fetching recent calls
      }
    }

    return NextResponse.json({
      status: authenticated ? "connected" : "disconnected",
      accountKey: authenticated ? accountKey : null,
      recentCalls,
      webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/goto`,
      authUrl: !authenticated ? getAuthorizationUrl() : null,
      features: {
        callEvents: true,
        callReports: true,
        recordings: true,
        transcriptions: true,
      },
    });
  } catch (error) {
    console.error("[GoTo Integration] Error getting status:", error);
    return NextResponse.json(
      {
        error: "Failed to get integration status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/integrations/goto
 *
 * Set up or reconfigure GoTo Connect integration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action === "setup" || action === "reconnect") {
      // Check if authenticated
      if (!isAuthenticated()) {
        return NextResponse.json(
          {
            error: "Not authenticated",
            message: "Please complete OAuth flow first",
            authUrl: getAuthorizationUrl(),
          },
          { status: 401 }
        );
      }

      // Run setup
      const webhookUrl =
        (body.webhookUrl as string) ||
        `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/goto`;

      const result = await setupGoToIntegration(webhookUrl);

      return NextResponse.json({
        success: true,
        message: "GoTo Connect integration configured successfully",
        channelId: result.channelId,
        webhookUrl: result.webhookUrl,
        subscriptions: result.subscriptions,
      });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'setup' or 'reconnect'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[GoTo Integration] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to configure integration",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
