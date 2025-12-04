import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, activityLogs, webhookLogs } from "@/db/schema";
import { parseWebhookWithAI, isAIParsingAvailable } from "@/lib/ai";
import type { ParsedWebhookData } from "@/lib/ai";
import { eq } from "drizzle-orm";

// Store processed webhook IDs to prevent replay (in production, use Redis or database)
const processedWebhooks = new Set<string>();
const MAX_PROCESSED_WEBHOOKS = 10000;

/**
 * VAPI Webhook Endpoint
 *
 * This endpoint receives call data from VAPI assistants after calls complete.
 * All call data (transcript, recording, caller info, etc.) is sent as JSON.
 *
 * Expected VAPI payload structure includes:
 * - message.type: "end-of-call-report"
 * - message.call: Call details including transcript, recording, etc.
 * - message.customer: Customer/caller information
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let webhookLogId: string | null = null;

  // Extract request metadata
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const ipAddress = request.headers.get("x-forwarded-for") ||
                    request.headers.get("x-real-ip") ||
                    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  try {
    const rawBody = await request.text();

    // Try to parse as JSON
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody);
    } catch {
      // Try to log failed webhook (don't fail the request if logging fails)
      try {
        await db.insert(webhookLogs).values({
          endpoint: "/api/webhooks/vapi",
          source: "vapi",
          status: "failed",
          httpMethod: "POST",
          headers: headers as Record<string, unknown>,
          rawPayload: { raw: rawBody.substring(0, 10000) } as Record<string, unknown>,
          errorMessage: "Invalid JSON payload",
          processingTimeMs: Date.now() - startTime,
          ipAddress,
          userAgent,
        });
      } catch (logError) {
        console.error("[VAPI Webhook] Failed to log webhook error:", logError);
      }

      console.error("[VAPI Webhook] Failed to parse JSON payload");
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Create initial webhook log entry (don't fail if logging fails)
    try {
      const [webhookLog] = await db.insert(webhookLogs).values({
        endpoint: "/api/webhooks/vapi",
        source: "vapi",
        status: "received",
        httpMethod: "POST",
        headers: headers as Record<string, unknown>,
        rawPayload: data as Record<string, unknown>,
        ipAddress,
        userAgent,
      }).returning({ id: webhookLogs.id });
      webhookLogId = webhookLog?.id || null;
    } catch (logError) {
      console.error("[VAPI Webhook] Failed to create webhook log:", logError);
      // Continue processing even if logging fails
    }

    // Log incoming webhook for debugging
    console.log("[VAPI Webhook] Received payload:", JSON.stringify(data, null, 2));

    // Extract VAPI-specific fields
    const message = data.message as Record<string, unknown> | undefined;
    const messageType = message?.type as string | undefined;

    // Generate unique event ID for idempotency
    const callId = (message?.call as Record<string, unknown>)?.id as string ||
                   (data.call as Record<string, unknown>)?.id as string ||
                   data.callId as string ||
                   `vapi-${Date.now()}`;

    // Check for duplicate processing
    if (processedWebhooks.has(callId)) {
      console.log("[VAPI Webhook] Duplicate webhook ignored:", callId);

      // Update webhook log
      if (webhookLogId) {
        await db.update(webhookLogs)
          .set({
            status: "stored",
            processingTimeMs: Date.now() - startTime,
            errorMessage: "Duplicate - already processed",
          })
          .where(eq(webhookLogs.id, webhookLogId));
      }

      return NextResponse.json({
        success: true,
        message: "Webhook already processed",
        duplicate: true,
      });
    }

    // Add to processed set (with cleanup)
    processedWebhooks.add(callId);
    if (processedWebhooks.size > MAX_PROCESSED_WEBHOOKS) {
      const firstItem = processedWebhooks.values().next().value;
      if (firstItem) {
        processedWebhooks.delete(firstItem);
      }
    }

    // Update status to parsing
    if (webhookLogId) {
      await db.update(webhookLogs)
        .set({ status: "parsing" })
        .where(eq(webhookLogs.id, webhookLogId));
    }

    // Try AI parsing if available
    let parsedData: ParsedWebhookData | null = null;
    const aiParsingAvailable = isAIParsingAvailable();

    if (aiParsingAvailable) {
      console.log("[VAPI Webhook] AI parsing available, processing...");
      parsedData = await parseWebhookWithAI(data);
      console.log("[VAPI Webhook] AI parsed result:", JSON.stringify(parsedData, null, 2));
    }

    // Update status to parsed with AI summary for quick visibility
    if (webhookLogId) {
      await db.update(webhookLogs)
        .set({
          status: "parsed",
          aiParsingUsed: aiParsingAvailable,
          aiConfidence: parsedData?.confidence ? Math.round(parsedData.confidence * 100) : null,
          parsedData: parsedData as unknown as Record<string, unknown>,
          aiSummary: parsedData?.analysis?.summary || null,
          aiCategory: parsedData?.analysis?.category || null,
        })
        .where(eq(webhookLogs.id, webhookLogId));
    }

    // Extract call data from VAPI payload
    // VAPI can send data in different structures depending on the event type
    const vapiCall = (message?.call || data.call || data) as Record<string, unknown>;
    const customer = (message?.customer || data.customer || {}) as Record<string, unknown>;
    const artifact = (message?.artifact || data.artifact || {}) as Record<string, unknown>;

    // Extract key fields
    const vapiCustomer = vapiCall?.customer as Record<string, unknown> | undefined;
    const callerPhone =
      parsedData?.contact.phone ||
      customer?.number as string ||
      vapiCustomer?.number as string ||
      null;

    const callerName =
      parsedData?.contact.name ||
      (parsedData?.contact.firstName
        ? `${parsedData.contact.firstName} ${parsedData.contact.lastName || ""}`.trim()
        : null) ||
      customer?.name as string ||
      null;

    const transcript =
      parsedData?.call?.transcript ||
      artifact?.transcript as string ||
      vapiCall?.transcript as string ||
      null;

    const recordingUrl =
      parsedData?.call?.recordingUrl ||
      artifact?.recordingUrl as string ||
      vapiCall?.recordingUrl as string ||
      null;

    const duration =
      parsedData?.call?.duration ||
      (vapiCall?.duration as number) ||
      (vapiCall?.endedAt && vapiCall?.startedAt
        ? Math.round(
            (new Date(vapiCall.endedAt as string).getTime() -
              new Date(vapiCall.startedAt as string).getTime()) /
              1000
          )
        : null);

    const summary =
      parsedData?.analysis.summary ||
      parsedData?.call?.summary ||
      artifact?.summary as string ||
      vapiCall?.summary as string ||
      "Call completed";

    const rawDirection =
      parsedData?.call?.direction ||
      (vapiCall?.direction as string) ||
      "inbound";
    // Only accept valid direction values
    const direction: "inbound" | "outbound" =
      rawDirection === "outbound" ? "outbound" : "inbound";

    // Store call record
    const [insertedCall] = await db.insert(calls).values({
      vapiCallId: callId,
      callerPhone,
      callerName,
      status: "completed",
      direction,
      duration,
      transcription: transcript,
      summary,
      intent: parsedData?.analysis.category || messageType || null,
      sentiment: parsedData?.analysis.sentiment || null,
      recordingUrl,
      metadata: {
        vapiMessageType: messageType,
        sourceProvider: "vapi",
        analysis: parsedData?.analysis || null,
        parsedAt: parsedData?.parsedAt || new Date().toISOString(),
        confidence: parsedData?.confidence || null,
        aiParsed: !!parsedData,
        webhookLogId,
      },
    }).returning({ id: calls.id });

    const recordId = insertedCall?.id || null;

    // Update webhook log with final status
    if (webhookLogId) {
      await db.update(webhookLogs)
        .set({
          status: "stored",
          resultCallId: recordId,
          processingTimeMs: Date.now() - startTime,
        })
        .where(eq(webhookLogs.id, webhookLogId));
    }

    // Log activity
    await db.insert(activityLogs).values({
      type: direction === "inbound" ? "call_received" : "call_made",
      description: `${direction === "inbound" ? "Inbound" : "Outbound"} VAPI call${callerPhone ? ` from ${callerPhone}` : ""} - ${summary}`,
      metadata: {
        callId: recordId,
        vapiCallId: callId,
        category: parsedData?.analysis.category || null,
        urgency: parsedData?.analysis.urgency || null,
        webhookLogId,
      },
    });

    console.log("[VAPI Webhook] Call stored with ID:", recordId);

    return NextResponse.json({
      success: true,
      message: "VAPI webhook processed successfully",
      recordId,
      callId,
      webhookLogId,
      aiParsed: !!parsedData,
      summary,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[VAPI Webhook] Error processing webhook:", error);

    // Update webhook log with error
    if (webhookLogId) {
      await db.update(webhookLogs)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
          processingTimeMs: Date.now() - startTime,
        })
        .where(eq(webhookLogs.id, webhookLogId));
    }

    return NextResponse.json(
      { error: "Internal server error", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// GET endpoint for health check and verification
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    endpoint: "/api/webhooks/vapi",
    description: "VAPI webhook endpoint for receiving call data",
    supportedMethods: ["POST"],
    usage: "Configure this URL as your VAPI assistant's Server URL",
    timestamp: new Date().toISOString(),
  });
}
