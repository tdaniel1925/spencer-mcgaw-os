/**
 * Audit Logs API
 * GET /api/audit/logs?type=...&startDate=...&endDate=...&userId=...
 *
 * Fetches audit logs with statistics for admin dashboard.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { activityLogs, users } from "@/db/schema";
import { and, eq, gte, lte, desc, sql } from "drizzle-orm";
import logger from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    // Authenticate user (admin only)
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const [userProfile] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);

    if (!userProfile || userProfile.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const activityType = searchParams.get("type");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const filterUserId = searchParams.get("userId");

    // Build query conditions
    const conditions = [];

    if (startDate) {
      conditions.push(gte(activityLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(activityLogs.createdAt, new Date(endDate)));
    }

    if (activityType && activityType !== "all") {
      conditions.push(eq(activityLogs.type, activityType as any));
    }

    if (filterUserId) {
      conditions.push(eq(activityLogs.userId, filterUserId));
    }

    // Fetch audit logs with user details
    const logs = await db
      .select({
        id: activityLogs.id,
        type: activityLogs.type,
        description: activityLogs.description,
        userId: activityLogs.userId,
        clientId: activityLogs.clientId,
        taskId: activityLogs.taskId,
        callId: activityLogs.callId,
        emailId: activityLogs.emailId,
        documentId: activityLogs.documentId,
        metadata: activityLogs.metadata,
        ipAddress: activityLogs.ipAddress,
        userAgent: activityLogs.userAgent,
        createdAt: activityLogs.createdAt,
        userEmail: users.email,
        userFullName: users.fullName,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activityLogs.createdAt))
      .limit(1000); // Limit for performance

    // Calculate statistics
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Count total activities
    const [totalResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(activityLogs);

    // Count today's activities
    const [todayResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(activityLogs)
      .where(gte(activityLogs.createdAt, todayStart));

    // Count this week's activities
    const [weekResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(activityLogs)
      .where(gte(activityLogs.createdAt, weekStart));

    // Count this month's activities
    const [monthResult] = await db
      .select({ count: sql<number>`cast(count(*) as integer)` })
      .from(activityLogs)
      .where(gte(activityLogs.createdAt, monthStart));

    // Count by type
    const byTypeResults = await db
      .select({
        type: activityLogs.type,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(activityLogs)
      .groupBy(activityLogs.type);

    const byType: Record<string, number> = {};
    byTypeResults.forEach((row) => {
      if (row.type) {
        byType[row.type] = row.count;
      }
    });

    // Top users by activity count
    const topUsersResults = await db
      .select({
        userId: activityLogs.userId,
        userEmail: users.email,
        count: sql<number>`cast(count(*) as integer)`,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .where(sql`${activityLogs.userId} IS NOT NULL`)
      .groupBy(activityLogs.userId, users.email)
      .orderBy(desc(sql`count(*)`))
      .limit(10);

    const topUsers = topUsersResults.map((row) => ({
      userId: row.userId || "",
      userEmail: row.userEmail || "Unknown",
      count: row.count,
    }));

    // Build statistics object
    const stats = {
      totalActivities: totalResult?.count || 0,
      todayCount: todayResult?.count || 0,
      weekCount: weekResult?.count || 0,
      monthCount: monthResult?.count || 0,
      byType,
      topUsers,
    };

    // Format logs for response
    const formattedLogs = logs.map((log) => ({
      id: log.id,
      type: log.type,
      description: log.description,
      userId: log.userId,
      userEmail: log.userEmail || undefined,
      userFullName: log.userFullName || undefined,
      ipAddress: log.ipAddress,
      createdAt: log.createdAt.toISOString(),
      metadata: log.metadata,
    }));

    logger.info("[Audit Logs] Fetched audit data", {
      userId: user.id,
      logsCount: formattedLogs.length,
      filters: { activityType, startDate, endDate, filterUserId },
    });

    return NextResponse.json({
      stats,
      logs: formattedLogs,
    });
  } catch (error) {
    logger.error("[Audit Logs] Failed to fetch audit logs", { error });

    return NextResponse.json(
      {
        error: "Failed to fetch audit logs",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
