/**
 * Email Sync Cron Job
 * GET /api/cron/sync-emails
 *
 * Syncs emails from all connected Fastmail accounts
 * Should be called every 5 minutes by a cron service
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllFastmailAccounts } from "@/lib/email/fastmail-sync";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (only in production)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const isProduction = process.env.NODE_ENV === "production";

    if (isProduction && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn("[Cron] Unauthorized sync attempt");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    logger.info("[Cron] Starting email sync for all users");

    const result = await syncAllFastmailAccounts();

    logger.info("[Cron] Email sync complete", {
      usersSynced: result.usersSynced,
      totalEmailsProcessed: result.totalEmailsProcessed,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      usersSynced: result.usersSynced,
      totalEmailsProcessed: result.totalEmailsProcessed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[Cron] Email sync failed", { error });
    return NextResponse.json(
      {
        error: "Sync failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Also support POST for manual triggers
export async function POST(request: NextRequest) {
  return GET(request);
}
