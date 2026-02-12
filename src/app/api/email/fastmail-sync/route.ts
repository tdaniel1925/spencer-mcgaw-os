/**
 * Fastmail Email Sync API
 * POST /api/email/fastmail-sync
 *
 * Triggers email sync from Fastmail IMAP for ALL users
 */

import { NextRequest, NextResponse } from "next/server";
import { syncAllFastmailAccounts } from "@/lib/email/fastmail-sync";
import logger from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    logger.info("[Fastmail Sync API] Sync requested for all users");

    // Run sync for ALL users with Fastmail connections
    const result = await syncAllFastmailAccounts();

    if (!result.success) {
      return NextResponse.json(
        {
          error: "Sync failed",
          errors: result.errors,
        },
        { status: 500 }
      );
    }

    logger.info("[Fastmail Sync API] ✅ Sync complete", {
      usersSynced: result.usersSynced,
      totalEmailsProcessed: result.totalEmailsProcessed,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.totalEmailsProcessed} emails for ${result.usersSynced} users`,
      totalEmailsProcessed: result.totalEmailsProcessed,
      usersSynced: result.usersSynced,
      errors: result.errors,
    });
  } catch (error) {
    logger.error("[Fastmail Sync API] Sync error", { error });

    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
