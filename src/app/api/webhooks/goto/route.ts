import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, activityLogs, webhookLogs } from "@/db/schema";
import { parseWebhookWithAI, isAIParsingAvailable } from "@/lib/ai";
import type { ParsedWebhookData } from "@/lib/ai";
import { getCallReport, getRecordingUrl, getTranscription } from "@/lib/goto";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// Store processed webhook IDs to prevent replay
const processedWebhooks = new Set<string>();
const MAX_PROCESSED_WEBHOOKS = 10000;

/**
 * Verify GoTo Connect webhook signature
 */
function verifySignature(
  payload: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature || !secret) {
    // In development, allow unsigned webhooks if no secret configured
    if (process.env.NODE_ENV === "development" && !secret) {
      console.log("[GoTo Webhook] Skipping signature verification (no secret configured)");
      return true;
    }
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

/**
 * GoTo Connect Webhook Endpoint
 *
 * Receives call events and call report notifications from GoTo Connect.
 *
 * Event Types:
 * - Call Events: STARTING, ACTIVE, ENDING
 * - Report Summary: Contains conversationSpaceId for fetching full report
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let webhookLogId: string | null = null;

  // Extract request metadata
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });
  const ipAddress =
    request.headers.get("x-forwarded-for") ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";
  const signature = request.headers.get("x-webhook-signature");

  try {
    const rawBody = await request.text();

    // Verify signature if secret is configured
    const webhookSecret = process.env.GOTO_WEBHOOK_SECRET;
    if (webhookSecret && !verifySignature(rawBody, signature, webhookSecret)) {
      console.error("[GoTo Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Parse JSON payload
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody);
    } catch {
      console.error("[GoTo Webhook] Failed to parse JSON payload");
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    console.log("[GoTo Webhook] Received payload:", JSON.stringify(data, null, 2));

    // Extract event info from GoTo Connect notification structure
    // GoTo sends: { data: { source: "...", type: "...", timestamp: "...", content: {...} } }
    const notificationData = (data.data || data) as Record<string, unknown>;
    const source = notificationData.source as string | undefined;
    const eventType = notificationData.type as string | undefined;
    const content = (notificationData.content || {}) as Record<string, unknown>;

    // Generate unique event ID for idempotency
    const eventId =
      (content.conversationSpaceId as string) ||
      (content.callId as string) ||
      (data.id as string) ||
      `goto-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Check for duplicate processing
    if (processedWebhooks.has(eventId)) {
      console.log("[GoTo Webhook] Duplicate webhook ignored:", eventId);
      return NextResponse.json({
        success: true,
        message: "Webhook already processed",
        duplicate: true,
      });
    }

    // Create webhook log entry
    try {
      const [webhookLog] = await db
        .insert(webhookLogs)
        .values({
          endpoint: "/api/webhooks/goto",
          source: "goto",
          status: "received",
          httpMethod: "POST",
          headers: headers as Record<string, unknown>,
          rawPayload: data as Record<string, unknown>,
          ipAddress,
          userAgent,
        })
        .returning({ id: webhookLogs.id });
      webhookLogId = webhookLog?.id || null;
    } catch (logError) {
      console.error("[GoTo Webhook] Failed to create webhook log:", logError);
    }

    // Add to processed set
    processedWebhooks.add(eventId);
    if (processedWebhooks.size > MAX_PROCESSED_WEBHOOKS) {
      const firstItem = processedWebhooks.values().next().value;
      if (firstItem) {
        processedWebhooks.delete(firstItem);
      }
    }

    // Update status to parsing
    if (webhookLogId) {
      await db
        .update(webhookLogs)
        .set({ status: "parsing" })
        .where(eq(webhookLogs.id, webhookLogId));
    }

    // Handle different event types
    let callRecord: {
      id: string;
      callerPhone: string | null;
      callerName: string | null;
      direction: "inbound" | "outbound";
      duration: number | null;
      transcript: string | null;
      summary: string | null;
      recordingUrl: string | null;
    } | null = null;

    if (source === "call-events-report" && eventType === "REPORT_SUMMARY") {
      // This is a call report notification - fetch the full report
      callRecord = await processCallReport(content, webhookLogId);
    } else if (source === "call-events") {
      // This is a real-time call event
      callRecord = await processCallEvent(eventType || "UNKNOWN", content, notificationData, webhookLogId);
    } else {
      // Unknown event type - try AI parsing
      callRecord = await processUnknownEvent(data, webhookLogId);
    }

    // Update webhook log with final status
    if (webhookLogId) {
      await db
        .update(webhookLogs)
        .set({
          status: "stored",
          resultCallId: callRecord?.id || null,
          processingTimeMs: Date.now() - startTime,
        })
        .where(eq(webhookLogs.id, webhookLogId));
    }

    console.log("[GoTo Webhook] Processed successfully:", {
      eventId,
      eventType,
      callRecordId: callRecord?.id,
    });

    return NextResponse.json({
      success: true,
      message: "GoTo Connect webhook processed successfully",
      recordId: callRecord?.id,
      eventId,
      eventType,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[GoTo Webhook] Error processing webhook:", error);

    // Update webhook log with error
    if (webhookLogId) {
      await db
        .update(webhookLogs)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          errorStack: error instanceof Error ? error.stack : undefined,
          processingTimeMs: Date.now() - startTime,
        })
        .where(eq(webhookLogs.id, webhookLogId));
    }

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Process a call report summary notification
 * Fetches the full report and stores the call record
 */
async function processCallReport(
  content: Record<string, unknown>,
  webhookLogId: string | null
): Promise<{
  id: string;
  callerPhone: string | null;
  callerName: string | null;
  direction: "inbound" | "outbound";
  duration: number | null;
  transcript: string | null;
  summary: string | null;
  recordingUrl: string | null;
}> {
  const conversationSpaceId = content.conversationSpaceId as string;

  if (!conversationSpaceId) {
    throw new Error("Missing conversationSpaceId in call report notification");
  }

  console.log("[GoTo Webhook] Fetching call report:", conversationSpaceId);

  // Fetch the full call report
  let report;
  try {
    report = await getCallReport(conversationSpaceId);
  } catch (error) {
    console.error("[GoTo Webhook] Failed to fetch call report:", error);
    // Store what we have
    report = {
      conversationSpaceId,
      callCreated: new Date().toISOString(),
      callEnded: new Date().toISOString(),
      direction: "INBOUND" as const,
      accountKey: "",
      participants: [],
    };
  }

  // Calculate duration from timestamps
  const startTime = new Date(report.callCreated);
  const endTime = new Date(report.callEnded);
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

  // Determine direction
  const direction: "inbound" | "outbound" =
    report.direction === "OUTBOUND" ? "outbound" : "inbound";

  // Try to get recording and transcription if available
  let recordingUrl: string | null = null;
  let transcript: string | null = null;

  // Note: GoTo Connect recording/transcription IDs come from separate notifications
  // We'll need to correlate them later or fetch from the recordings API
  const recordingId = content.recordingId as string | undefined;
  const transcriptId = content.transcriptId as string | undefined;

  if (recordingId) {
    try {
      recordingUrl = await getRecordingUrl(recordingId);
    } catch (error) {
      console.error("[GoTo Webhook] Failed to get recording URL:", error);
    }
  }

  if (transcriptId) {
    try {
      const transcriptData = await getTranscription(transcriptId);
      transcript = transcriptData.text;
    } catch (error) {
      console.error("[GoTo Webhook] Failed to get transcription:", error);
    }
  }

  // Try AI parsing if available
  let parsedData: ParsedWebhookData | null = null;
  if (isAIParsingAvailable()) {
    parsedData = await parseWebhookWithAI({
      source: "goto_connect",
      type: "call_report",
      report,
      transcript,
    });
  }

  // Extract caller info from participants
  const callerParticipant = report.participants.find((p) => p.originator);
  const callerPhone = (callerParticipant?.id as string) || null;

  // Store call record
  const [insertedCall] = await db
    .insert(calls)
    .values({
      vapiCallId: `goto-${conversationSpaceId}`,
      callerPhone: parsedData?.contact?.phone || callerPhone,
      callerName: parsedData?.contact?.name || null,
      status: "completed",
      direction,
      duration,
      transcription: transcript,
      summary: parsedData?.analysis?.summary || `GoTo Connect call - ${duration}s`,
      intent: parsedData?.analysis?.category || null,
      sentiment: parsedData?.analysis?.sentiment || null,
      recordingUrl,
      metadata: {
        sourceProvider: "goto",
        gotoConversationSpaceId: conversationSpaceId,
        gotoAccountKey: report.accountKey,
        participants: report.participants,
        analysis: parsedData?.analysis || null,
        parsedAt: new Date().toISOString(),
        confidence: parsedData?.confidence || null,
        aiParsed: !!parsedData,
        webhookLogId,
      },
    })
    .returning({ id: calls.id });

  const recordId = insertedCall?.id || null;

  // Log activity
  await db.insert(activityLogs).values({
    type: direction === "inbound" ? "call_received" : "call_made",
    description: `${direction === "inbound" ? "Inbound" : "Outbound"} GoTo Connect call${callerPhone ? ` from ${callerPhone}` : ""} - ${duration}s`,
    metadata: {
      callId: recordId,
      gotoConversationSpaceId: conversationSpaceId,
      category: parsedData?.analysis?.category || null,
      urgency: parsedData?.analysis?.urgency || null,
      webhookLogId,
    },
  });

  return {
    id: recordId || "",
    callerPhone: parsedData?.contact?.phone || callerPhone,
    callerName: parsedData?.contact?.name || null,
    direction,
    duration,
    transcript,
    summary: parsedData?.analysis?.summary || null,
    recordingUrl,
  };
}

/**
 * Process real-time call events (STARTING, ACTIVE, ENDING)
 */
async function processCallEvent(
  eventType: string,
  content: Record<string, unknown>,
  fullData: Record<string, unknown>,
  webhookLogId: string | null
): Promise<{
  id: string;
  callerPhone: string | null;
  callerName: string | null;
  direction: "inbound" | "outbound";
  duration: number | null;
  transcript: string | null;
  summary: string | null;
  recordingUrl: string | null;
} | null> {
  // For real-time events, we mainly care about ENDING events
  // STARTING and ACTIVE events can be logged but don't need full processing
  if (eventType !== "ENDING") {
    console.log(`[GoTo Webhook] Received ${eventType} event - logging only`);

    // Just log the activity without creating a call record
    await db.insert(activityLogs).values({
      type: eventType === "STARTING" ? "call_received" : "webhook_received",
      description: `GoTo Connect call ${eventType.toLowerCase()}`,
      metadata: {
        eventType,
        content,
        webhookLogId,
      },
    });

    return null;
  }

  // For ENDING events, extract call data
  const conversationSpaceId = content.conversationSpaceId as string;
  const state = (content.state || fullData.state) as Record<string, unknown> | undefined;
  const metadata = (content.metadata || fullData.metadata) as Record<string, unknown> | undefined;

  const direction: "inbound" | "outbound" =
    (state?.direction as string)?.toLowerCase() === "outbound" ? "outbound" : "inbound";

  const callerPhone =
    (state?.originator as string) ||
    (metadata?.callerNumber as string) ||
    null;

  // Try AI parsing
  let parsedData: ParsedWebhookData | null = null;
  if (isAIParsingAvailable()) {
    parsedData = await parseWebhookWithAI({
      source: "goto_connect",
      type: "call_ending",
      eventType,
      content,
      fullData,
    });
  }

  // Store call record
  const [insertedCall] = await db
    .insert(calls)
    .values({
      vapiCallId: conversationSpaceId ? `goto-${conversationSpaceId}` : `goto-${Date.now()}`,
      callerPhone: parsedData?.contact?.phone || callerPhone,
      callerName: parsedData?.contact?.name || null,
      status: "completed",
      direction,
      duration: parsedData?.call?.duration || null,
      transcription: null, // Will be updated when transcription is available
      summary: parsedData?.analysis?.summary || "GoTo Connect call ended",
      intent: parsedData?.analysis?.category || null,
      sentiment: parsedData?.analysis?.sentiment || null,
      recordingUrl: null, // Will be updated when recording is available
      metadata: {
        sourceProvider: "goto",
        eventType,
        gotoConversationSpaceId: conversationSpaceId,
        analysis: parsedData?.analysis || null,
        parsedAt: new Date().toISOString(),
        confidence: parsedData?.confidence || null,
        aiParsed: !!parsedData,
        webhookLogId,
      },
    })
    .returning({ id: calls.id });

  const recordId = insertedCall?.id || null;

  // Log activity
  await db.insert(activityLogs).values({
    type: direction === "inbound" ? "call_received" : "call_made",
    description: `${direction === "inbound" ? "Inbound" : "Outbound"} GoTo Connect call ended${callerPhone ? ` from ${callerPhone}` : ""}`,
    metadata: {
      callId: recordId,
      gotoConversationSpaceId: conversationSpaceId,
      eventType,
      webhookLogId,
    },
  });

  return {
    id: recordId || "",
    callerPhone: parsedData?.contact?.phone || callerPhone,
    callerName: parsedData?.contact?.name || null,
    direction,
    duration: parsedData?.call?.duration || null,
    transcript: null,
    summary: parsedData?.analysis?.summary || null,
    recordingUrl: null,
  };
}

/**
 * Process unknown event types using AI parsing
 */
async function processUnknownEvent(
  data: Record<string, unknown>,
  webhookLogId: string | null
): Promise<{
  id: string;
  callerPhone: string | null;
  callerName: string | null;
  direction: "inbound" | "outbound";
  duration: number | null;
  transcript: string | null;
  summary: string | null;
  recordingUrl: string | null;
} | null> {
  console.log("[GoTo Webhook] Processing unknown event type with AI");

  let parsedData: ParsedWebhookData | null = null;
  if (isAIParsingAvailable()) {
    parsedData = await parseWebhookWithAI({
      source: "goto_connect",
      type: "unknown",
      data,
    });
  }

  // Only create a record if it looks like a phone call
  if (parsedData?.source !== "phone_call") {
    console.log("[GoTo Webhook] Unknown event doesn't appear to be a phone call");
    return null;
  }

  const direction: "inbound" | "outbound" =
    parsedData.call?.direction || "inbound";

  const [insertedCall] = await db
    .insert(calls)
    .values({
      vapiCallId: `goto-unknown-${Date.now()}`,
      callerPhone: parsedData.contact?.phone || null,
      callerName: parsedData.contact?.name || null,
      status: "completed",
      direction,
      duration: parsedData.call?.duration || null,
      transcription: parsedData.call?.transcript || null,
      summary: parsedData.analysis?.summary || "GoTo Connect call",
      intent: parsedData.analysis?.category || null,
      sentiment: parsedData.analysis?.sentiment || null,
      recordingUrl: parsedData.call?.recordingUrl || null,
      metadata: {
        sourceProvider: "goto",
        eventType: "unknown",
        analysis: parsedData.analysis || null,
        parsedAt: new Date().toISOString(),
        confidence: parsedData.confidence || null,
        aiParsed: true,
        webhookLogId,
      },
    })
    .returning({ id: calls.id });

  return {
    id: insertedCall?.id || "",
    callerPhone: parsedData.contact?.phone || null,
    callerName: parsedData.contact?.name || null,
    direction,
    duration: parsedData.call?.duration || null,
    transcript: parsedData.call?.transcript || null,
    summary: parsedData.analysis?.summary || null,
    recordingUrl: parsedData.call?.recordingUrl || null,
  };
}

// GET endpoint for health check and verification
export async function GET() {
  return NextResponse.json({
    status: "healthy",
    endpoint: "/api/webhooks/goto",
    description: "GoTo Connect webhook endpoint for receiving call events and reports",
    supportedMethods: ["POST"],
    usage: "Configure this URL as your GoTo Connect webhook notification channel",
    timestamp: new Date().toISOString(),
  });
}
