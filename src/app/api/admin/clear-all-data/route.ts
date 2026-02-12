/**
 * Clear All Data API
 * DELETE /api/admin/clear-all-data
 *
 * Clears all data except users (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const { data: userProfile } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (userProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    logger.info("[Clear Data] Starting cleanup", { userId: user.id });

    const tablesToClear = [
      'activity_logs',
      'potential_tasks',
      'email_messages',
      'email_threads',
      'email_sync_state',
      'email_connections',
      'task_comments',
      'tasks',
      'calls',
      'sms_messages',
      'documents',
      'contacts',
      'clients',
      'calendar_events',
      'chat_messages',
      'chat_rooms',
      'notifications',
    ];

    const results = [];

    for (const table of tablesToClear) {
      try {
        const { error } = await supabase
          .from(table)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) {
          results.push({ table, status: 'error', message: error.message });
          logger.warn(`[Clear Data] Could not clear ${table}`, { error });
        } else {
          results.push({ table, status: 'success' });
          logger.info(`[Clear Data] Cleared ${table}`);
        }
      } catch (error) {
        results.push({
          table,
          status: 'error',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    logger.info("[Clear Data] Cleanup complete", {
      successCount,
      totalTables: tablesToClear.length
    });

    return NextResponse.json({
      success: true,
      message: `Cleared ${successCount} of ${tablesToClear.length} tables`,
      results,
    });

  } catch (error) {
    logger.error("[Clear Data] Error", { error });
    return NextResponse.json(
      { error: "Failed to clear data" },
      { status: 500 }
    );
  }
}
