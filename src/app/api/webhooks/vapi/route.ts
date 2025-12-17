import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, activityLogs, webhookLogs } from "@/db/schema";
import { parseWebhookWithAI, isAIParsingAvailable } from "@/lib/ai";
import type { ParsedWebhookData } from "@/lib/ai";
import { eq } from "drizzle-orm";
import {
  generateTaskSuggestionsFromCall,
  storeTaskSuggestions,
  type CallContext,
} from "@/lib/ai/task-suggestion-engine";

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

    // Log incoming webhook for debugging
    console.log("[VAPI Webhook] Received payload:", JSON.stringify(data, null, 2));

    // Extract VAPI-specific fields
    const message = data.message as Record<string, unknown> | undefined;
    const messageType = message?.type as string | undefined;

    // Generate unique event ID for idempotency
    // VAPI can send call ID in various locations
    const callId = (message?.call as Record<string, unknown>)?.id as string ||
                   (data.call as Record<string, unknown>)?.id as string ||
                   data.callId as string ||
                   data.id as string ||
                   `vapi-${Date.now()}`;

    // Check for duplicate processing BEFORE creating log entry
    if (processedWebhooks.has(callId)) {
      console.log("[VAPI Webhook] Duplicate webhook ignored (not logged):", callId);
      // Don't create a log entry for duplicates - just return success
      return NextResponse.json({
        success: true,
        message: "Webhook already processed",
        duplicate: true,
      });
    }

    // Create webhook log entry only for non-duplicates
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
    // VAPI sends end-of-call-report with this structure:
    // { message: { type: "end-of-call-report", call: {...}, artifact: {...}, summary: "...", endedAt: "..." } }
    // The call object has nested customer: { number: "+1..." }
    // The artifact has messages array with the conversation
    const vapiMessage = message || data;
    const vapiCall = (message?.call || data.call || data) as Record<string, unknown>;
    const customer = (vapiCall?.customer || message?.customer || data.customer || {}) as Record<string, unknown>;
    const artifact = (message?.artifact || data.artifact || vapiCall?.artifact || {}) as Record<string, unknown>;

    // VAPI provides summary at the message level for end-of-call-report
    const vapiSummary = (message?.summary || data.summary) as string | undefined;
    const vapiAnalysis = (message?.analysis || data.analysis) as Record<string, unknown> | undefined;
    const vapiEndedAt = (message?.endedAt || data.endedAt) as string | undefined;

    // VAPI often puts transcript in artifact.messages array or artifact.transcript
    const artifactMessages = artifact?.messages as Array<Record<string, unknown>> | undefined;
    const artifactTranscript = artifact?.transcript as string | undefined;

    // Extract key fields with extensive fallbacks
    // Phone number can be in customer.number, phoneNumber, or nested structures
    const vapiCustomer = vapiCall?.customer as Record<string, unknown> | undefined;
    const callerPhone =
      parsedData?.contact?.phone ||
      (customer?.number as string) ||
      (customer?.phoneNumber as string) ||
      (vapiCustomer?.number as string) ||
      (vapiCustomer?.phoneNumber as string) ||
      (vapiCall?.phoneNumber as string) ||
      (data.phoneNumber as string) ||
      (data.from as string) ||
      (data.caller as string) ||
      null;

    const callerName =
      parsedData?.contact?.name ||
      (parsedData?.contact?.firstName
        ? `${parsedData.contact.firstName} ${parsedData.contact.lastName || ""}`.trim()
        : null) ||
      (customer?.name as string) ||
      (vapiCustomer?.name as string) ||
      (data.callerName as string) ||
      null;

    // Build transcript from artifact.messages array (VAPI's format)
    // VAPI stores conversation in artifact.messages as: { role: "user"|"bot"|"system", message: "..." }
    let transcript: string | null = null;

    // First try to build from messages array (most reliable for VAPI)
    if (artifactMessages && Array.isArray(artifactMessages) && artifactMessages.length > 0) {
      transcript = artifactMessages
        .filter((m: Record<string, unknown>) => m.role && m.message && m.role !== "system")
        .map((m: Record<string, unknown>) => {
          const role = m.role === "bot" ? "Assistant" : m.role === "user" ? "Caller" : String(m.role);
          return `${role}: ${m.message}`;
        })
        .join("\n\n");
    }

    // Fallback to other transcript sources
    if (!transcript) {
      transcript =
        parsedData?.call?.transcript ||
        artifactTranscript ||
        (artifact?.transcript as string) ||
        (vapiCall?.transcript as string) ||
        (data.transcript as string) ||
        null;
    }

    // Recording URL extraction
    const recordingUrl =
      parsedData?.call?.recordingUrl ||
      (artifact?.recordingUrl as string) ||
      (artifact?.recording as string) ||
      (vapiCall?.recordingUrl as string) ||
      (vapiCall?.recording as string) ||
      (data.recordingUrl as string) ||
      null;

    // Duration extraction with multiple strategies
    // VAPI provides createdAt and endedAt timestamps on the call object
    const callCreatedAt = (vapiCall?.createdAt || data.createdAt) as string | undefined;
    const callEndedAt = vapiEndedAt || (vapiCall?.endedAt || data.endedAt) as string | undefined;

    // Calculate duration from timestamps (most reliable for VAPI)
    let duration: number | null = null;
    if (callCreatedAt && callEndedAt) {
      duration = Math.round(
        (new Date(callEndedAt).getTime() - new Date(callCreatedAt).getTime()) / 1000
      );
    }

    // Fallback to explicit duration fields
    if (!duration || duration <= 0) {
      duration =
        parsedData?.call?.duration ||
        (artifact?.duration as number) ||
        (vapiCall?.duration as number) ||
        (data.duration as number) ||
        null;
    }

    // Use VAPI-provided summary first (it's already high quality from their AI)
    // Then fall back to our AI parsing, then generic message
    const summary =
      vapiSummary ||
      (vapiAnalysis?.summary as string) ||
      parsedData?.analysis?.summary ||
      parsedData?.call?.summary ||
      (artifact?.summary as string) ||
      (vapiCall?.summary as string) ||
      (transcript ? "Call with transcript available - see details" : "Call completed");

    // VAPI uses "type" field with values like "inboundPhoneCall" or "outboundPhoneCall"
    const callType = (vapiCall?.type as string) || "";
    const rawDirection =
      parsedData?.call?.direction ||
      (vapiCall?.direction as string) ||
      (data.direction as string) ||
      (callType.toLowerCase().includes("outbound") ? "outbound" : "inbound");
    // Only accept valid direction values
    const direction: "inbound" | "outbound" =
      rawDirection === "outbound" || rawDirection === "outboundPhoneCall" ? "outbound" : "inbound";

    // Debug log extracted data
    console.log("[VAPI Webhook] Extracted data:", {
      callerPhone,
      callerName,
      hasTranscript: !!transcript,
      transcriptLength: transcript?.length,
      duration,
      recordingUrl,
      direction,
      summary: summary?.substring(0, 100),
    });

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

    // Generate AI task suggestions from the call
    let suggestionIds: string[] = [];
    try {
      const callContext: CallContext = {
        callId: recordId || callId,
        callerPhone: callerPhone || undefined,
        callerName: callerName || undefined,
        transcript: transcript || undefined,
        summary: summary || undefined,
        category: parsedData?.analysis?.category || undefined,
        sentiment: parsedData?.analysis?.sentiment || undefined,
        urgency: parsedData?.analysis?.urgency || undefined,
        suggestedActions: parsedData?.analysis?.suggestedActions || undefined,
        keyPoints: parsedData?.analysis?.keyPoints || undefined,
        duration: duration || undefined,
      };

      console.log("[VAPI Webhook] Generating task suggestions for call:", recordId);
      const suggestions = await generateTaskSuggestionsFromCall(callContext);

      if (suggestions.length > 0) {
        console.log(`[VAPI Webhook] Generated ${suggestions.length} task suggestions`);
        suggestionIds = await storeTaskSuggestions(
          suggestions,
          "phone_call",
          recordId || callId,
          {
            vapiCallId: callId,
            callerPhone,
            callerName,
            category: parsedData?.analysis?.category,
            webhookLogId,
          }
        );
        console.log("[VAPI Webhook] Stored suggestion IDs:", suggestionIds);
      } else {
        console.log("[VAPI Webhook] No task suggestions generated for this call");
      }
    } catch (suggestionError) {
      // Don't fail the webhook if suggestion generation fails
      console.error("[VAPI Webhook] Error generating task suggestions:", suggestionError);
    }

    return NextResponse.json({
      success: true,
      message: "VAPI webhook processed successfully",
      recordId,
      callId,
      webhookLogId,
      aiParsed: !!parsedData,
      summary,
      taskSuggestions: suggestionIds.length,
      suggestionIds,
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
