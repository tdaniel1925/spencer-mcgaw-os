import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { webhookLogs, calls } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

/**
 * Webhook Monitor API
 *
 * GET /api/webhooks/monitor - Get webhook logs with optional filtering
 * Query params:
 * - limit: number of records (default 50)
 * - offset: pagination offset
 * - status: filter by status
 * - endpoint: filter by endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");
    const endpoint = searchParams.get("endpoint");

    // Build query
    let query = db.select({
      id: webhookLogs.id,
      endpoint: webhookLogs.endpoint,
      source: webhookLogs.source,
      status: webhookLogs.status,
      httpMethod: webhookLogs.httpMethod,
      headers: webhookLogs.headers,
      rawPayload: webhookLogs.rawPayload,
      parsedData: webhookLogs.parsedData,
      aiParsingUsed: webhookLogs.aiParsingUsed,
      aiConfidence: webhookLogs.aiConfidence,
      errorMessage: webhookLogs.errorMessage,
      processingTimeMs: webhookLogs.processingTimeMs,
      resultCallId: webhookLogs.resultCallId,
      ipAddress: webhookLogs.ipAddress,
      createdAt: webhookLogs.createdAt,
    })
    .from(webhookLogs)
    .orderBy(desc(webhookLogs.createdAt))
    .limit(limit)
    .offset(offset);

    // Apply filters
    const conditions = [];
    if (status) {
      conditions.push(eq(webhookLogs.status, status as "received" | "parsing" | "parsed" | "stored" | "failed"));
    }
    if (endpoint) {
      conditions.push(eq(webhookLogs.endpoint, endpoint));
    }

    const logs = await query;

    // Get total count
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(webhookLogs);
    const totalCount = Number(countResult?.count || 0);

    // Get stats
    const [stats] = await db.select({
      total: sql<number>`count(*)`,
      received: sql<number>`count(*) filter (where ${webhookLogs.status} = 'received')`,
      parsing: sql<number>`count(*) filter (where ${webhookLogs.status} = 'parsing')`,
      parsed: sql<number>`count(*) filter (where ${webhookLogs.status} = 'parsed')`,
      stored: sql<number>`count(*) filter (where ${webhookLogs.status} = 'stored')`,
      failed: sql<number>`count(*) filter (where ${webhookLogs.status} = 'failed')`,
      avgProcessingTime: sql<number>`avg(${webhookLogs.processingTimeMs})`,
      aiParsedCount: sql<number>`count(*) filter (where ${webhookLogs.aiParsingUsed} = true)`,
    }).from(webhookLogs);

    return NextResponse.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: totalCount,
          limit,
          offset,
          hasMore: offset + limit < totalCount,
        },
        stats: {
          total: Number(stats?.total || 0),
          byStatus: {
            received: Number(stats?.received || 0),
            parsing: Number(stats?.parsing || 0),
            parsed: Number(stats?.parsed || 0),
            stored: Number(stats?.stored || 0),
            failed: Number(stats?.failed || 0),
          },
          avgProcessingTimeMs: Math.round(Number(stats?.avgProcessingTime || 0)),
          aiParsedCount: Number(stats?.aiParsedCount || 0),
        },
      },
    });
  } catch (error) {
    console.error("[Webhook Monitor] Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhook logs", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * Get a single webhook log by ID
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "Missing webhook log ID" }, { status: 400 });
    }

    const [log] = await db.select().from(webhookLogs).where(eq(webhookLogs.id, id));

    if (!log) {
      return NextResponse.json({ error: "Webhook log not found" }, { status: 404 });
    }

    // If there's a result call, fetch it too
    let call = null;
    if (log.resultCallId) {
      [call] = await db.select().from(calls).where(eq(calls.id, log.resultCallId));
    }

    return NextResponse.json({
      success: true,
      data: {
        log,
        call,
      },
    });
  } catch (error) {
    console.error("[Webhook Monitor] Error fetching log:", error);
    return NextResponse.json(
      { error: "Failed to fetch webhook log", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
