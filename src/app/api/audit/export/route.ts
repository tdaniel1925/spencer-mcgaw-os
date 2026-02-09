/**
 * Audit Log Export API
 * GET /api/audit/export?format=csv|pdf&startDate=...&endDate=...&type=...&userId=...
 *
 * Exports audit logs in CSV or PDF format for compliance and reporting.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { activityLogs, users } from "@/db/schema";
import { and, eq, gte, lte, desc, inArray } from "drizzle-orm";
import { format } from "date-fns";
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
    const exportFormat = searchParams.get("format") || "csv";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const activityType = searchParams.get("type");
    const filterUserId = searchParams.get("userId");

    // Build query
    const conditions = [];

    if (startDate) {
      conditions.push(gte(activityLogs.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(activityLogs.createdAt, new Date(endDate)));
    }

    if (activityType) {
      conditions.push(eq(activityLogs.type, activityType as any));
    }

    if (filterUserId) {
      conditions.push(eq(activityLogs.userId, filterUserId));
    }

    // Fetch audit logs
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
      })
      .from(activityLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(activityLogs.createdAt))
      .limit(10000); // Safety limit

    // Get user details for mapping
    const userIds = [...new Set(logs.map((log) => log.userId).filter(Boolean))];
    const userMap = new Map();

    if (userIds.length > 0) {
      const userRecords = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
        })
        .from(users)
        .where(inArray(users.id, userIds as string[]));

      userRecords.forEach((u) => {
        userMap.set(u.id, {
          email: u.email,
          fullName: u.fullName,
        });
      });
    }

    // Export based on format
    if (exportFormat === "csv") {
      return exportAsCSV(logs, userMap);
    } else if (exportFormat === "pdf") {
      return exportAsPDF(logs, userMap, { startDate, endDate, activityType });
    } else {
      return NextResponse.json({ error: "Invalid format. Use 'csv' or 'pdf'" }, { status: 400 });
    }
  } catch (error) {
    logger.error("[Audit Export] Export failed", { error });

    return NextResponse.json(
      {
        error: "Export failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Export audit logs as CSV
 */
function exportAsCSV(logs: any[], userMap: Map<string, any>): NextResponse {
  // CSV Header
  const headers = [
    "Date/Time",
    "Activity Type",
    "Description",
    "User",
    "User Email",
    "IP Address",
    "Task ID",
    "Call ID",
    "Email ID",
    "Client ID",
    "Document ID",
  ];

  // CSV Rows
  const rows = logs.map((log) => {
    const user = log.userId ? userMap.get(log.userId) : null;

    return [
      format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss"),
      log.type || "",
      `"${(log.description || "").replace(/"/g, '""')}"`, // Escape quotes
      user?.fullName || log.userId || "",
      user?.email || "",
      log.ipAddress || "",
      log.taskId || "",
      log.callId || "",
      log.emailId || "",
      log.clientId || "",
      log.documentId || "",
    ].join(",");
  });

  const csv = [headers.join(","), ...rows].join("\n");

  const filename = `audit-log-${format(new Date(), "yyyy-MM-dd-HHmmss")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

/**
 * Export audit logs as PDF (simplified HTML report)
 */
function exportAsPDF(
  logs: any[],
  userMap: Map<string, any>,
  filters: { startDate?: string | null; endDate?: string | null; activityType?: string | null }
): NextResponse {
  const now = format(new Date(), "MMMM d, yyyy 'at' h:mm a");

  // Generate HTML report
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Audit Log Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; border-bottom: 3px solid #4F46E5; padding-bottom: 10px; }
    .meta { color: #666; font-size: 14px; margin-bottom: 30px; }
    .filters { background: #F3F4F6; padding: 15px; border-radius: 8px; margin-bottom: 30px; }
    .filters h3 { margin-top: 0; color: #374151; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #4F46E5; color: white; padding: 10px; text-align: left; font-weight: 600; }
    td { padding: 8px; border-bottom: 1px solid #E5E7EB; }
    tr:hover { background: #F9FAFB; }
    .footer { margin-top: 30px; text-align: center; color: #9CA3AF; font-size: 11px; }
  </style>
</head>
<body>
  <h1>🔒 Audit Log Report</h1>
  <div class="meta">Generated on: ${now}</div>

  <div class="filters">
    <h3>Report Filters</h3>
    <p><strong>Date Range:</strong> ${filters.startDate || "All"} to ${filters.endDate || "All"}</p>
    <p><strong>Activity Type:</strong> ${filters.activityType || "All"}</p>
    <p><strong>Total Records:</strong> ${logs.length}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date/Time</th>
        <th>Activity</th>
        <th>Description</th>
        <th>User</th>
        <th>IP Address</th>
      </tr>
    </thead>
    <tbody>
      ${logs
        .map((log) => {
          const user = log.userId ? userMap.get(log.userId) : null;
          return `
        <tr>
          <td>${format(new Date(log.createdAt), "MM/dd/yyyy HH:mm")}</td>
          <td>${log.type || "N/A"}</td>
          <td>${log.description || "N/A"}</td>
          <td>${user?.fullName || user?.email || "System"}</td>
          <td>${log.ipAddress || "N/A"}</td>
        </tr>
      `;
        })
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    <p>This is a confidential audit log report. Distribution restricted to authorized personnel only.</p>
  </div>
</body>
</html>
  `;

  const filename = `audit-log-${format(new Date(), "yyyy-MM-dd-HHmmss")}.html`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
