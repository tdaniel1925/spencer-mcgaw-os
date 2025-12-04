import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, activityLogs } from "@/db/schema";
import { parseWebhookWithAI, isAIParsingAvailable } from "@/lib/ai";
import type { ParsedWebhookData } from "@/lib/ai";

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
  try {
    const rawBody = await request.text();

    // Try to parse as JSON
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody);
    } catch {
      console.error("[VAPI Webhook] Failed to parse JSON payload");
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
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

    // Try AI parsing if available
    let parsedData: ParsedWebhookData | null = null;
    if (isAIParsingAvailable()) {
      console.log("[VAPI Webhook] AI parsing available, processing...");
      parsedData = await parseWebhookWithAI(data);
      console.log("[VAPI Webhook] AI parsed result:", JSON.stringify(parsedData, null, 2));
    }

    // Extract call data from VAPI payload
    // VAPI can send data in different structures depending on the event type
    const vapiCall = (message?.call || data.call || data) as Record<string, unknown>;
    const customer = (message?.customer || data.customer || {}) as Record<string, unknown>;
    const artifact = (message?.artifact || data.artifact || {}) as Record<string, unknown>;

    // Extract key fields
    const callerPhone =
      parsedData?.contact.phone ||
      customer?.number as string ||
      vapiCall?.customer?.number as string ||
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

    const direction =
      parsedData?.call?.direction ||
      (vapiCall?.direction as string) ||
      "inbound";

    // Store call record
    const [insertedCall] = await db.insert(calls).values({
      vapiCallId: callId,
      callerPhone,
      callerName,
      status: "completed",
      direction: direction as "inbound" | "outbound",
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
        rawPayload: data,
        parsedAt: parsedData?.parsedAt || new Date().toISOString(),
        confidence: parsedData?.confidence || null,
        aiParsed: !!parsedData,
      },
    }).returning({ id: calls.id });

    const recordId = insertedCall?.id || null;

    // Log activity
    await db.insert(activityLogs).values({
      type: direction === "inbound" ? "call_received" : "call_made",
      description: `${direction === "inbound" ? "Inbound" : "Outbound"} VAPI call${callerPhone ? ` from ${callerPhone}` : ""} - ${summary}`,
      metadata: {
        callId: recordId,
        vapiCallId: callId,
        category: parsedData?.analysis.category || null,
        urgency: parsedData?.analysis.urgency || null,
      },
    });

    console.log("[VAPI Webhook] Call stored with ID:", recordId);

    return NextResponse.json({
      success: true,
      message: "VAPI webhook processed successfully",
      recordId,
      callId,
      aiParsed: !!parsedData,
      summary,
    });
  } catch (error) {
    console.error("[VAPI Webhook] Error processing webhook:", error);
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
