import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, activityLogs, webhookLogs, clients, tasks } from "@/db/schema";
import { parseWebhookWithAI, isAIParsingAvailable } from "@/lib/ai";
import type { ParsedWebhookData } from "@/lib/ai";
import { getCallReport, getRecordingUrl, getTranscription } from "@/lib/goto";
import { eq, or, sql } from "drizzle-orm";
import crypto from "crypto";

/**
 * Try to match a phone number to an existing client
 */
async function matchPhoneToClient(phone: string | null): Promise<string | null> {
  if (!phone) return null;

  // Normalize phone number (remove non-digits)
  const normalizedPhone = phone.replace(/\D/g, "");
  if (normalizedPhone.length < 7) return null;

  try {
    // Try matching against client phone numbers
    const matchedClients = await db
      .select({ id: clients.id })
      .from(clients)
      .where(
        or(
          sql`regexp_replace(${clients.phone}, '[^0-9]', '', 'g') = ${normalizedPhone}`,
          sql`regexp_replace(${clients.phone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedPhone.slice(-10)}`,
          sql`regexp_replace(${clients.alternatePhone}, '[^0-9]', '', 'g') = ${normalizedPhone}`,
          sql`regexp_replace(${clients.alternatePhone}, '[^0-9]', '', 'g') LIKE ${'%' + normalizedPhone.slice(-10)}`
        )
      )
      .limit(1);

    if (matchedClients.length > 0) {
      console.log(`[GoTo Webhook] Matched phone ${phone} to client ${matchedClients[0].id}`);
      return matchedClients[0].id;
    }
  } catch (error) {
    console.error("[GoTo Webhook] Error matching phone to client:", error);
  }

  return null;
}

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
    } else if (source === "recording" && (eventType === "RECORDING_READY" || eventType === "TRANSCRIPTION_READY")) {
      // Recording or transcription is now available - update the associated call
      await processRecordingNotification(eventType, content, webhookLogId);
      // Return early - this is an update, not a new call
      if (webhookLogId) {
        await db
          .update(webhookLogs)
          .set({
            status: "stored",
            processingTimeMs: Date.now() - startTime,
          })
          .where(eq(webhookLogs.id, webhookLogId));
      }
      return NextResponse.json({
        success: true,
        message: `GoTo ${eventType} notification processed`,
        eventId,
        eventType,
        processingTimeMs: Date.now() - startTime,
      });
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
 * The REPORT_SUMMARY webhook contains all call data including recordings
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

  console.log("[GoTo Webhook] Processing call report:", conversationSpaceId);

  // Extract data directly from webhook content (more complete than API fetch)
  const callCreated = content.callCreated as string || new Date().toISOString();
  const callEnded = content.callEnded as string || new Date().toISOString();
  const callAnswered = content.callAnswered as string | undefined;
  const accountKey = content.accountKey as string || "";

  // Calculate duration from timestamps
  const startTime = new Date(callAnswered || callCreated);
  const endTime = new Date(callEnded);
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

  // Determine direction
  const rawDirection = content.direction as string | undefined;
  const direction: "inbound" | "outbound" =
    rawDirection === "OUTBOUND" ? "outbound" : "inbound";

  // Extract caller info from the webhook content
  const caller = content.caller as Record<string, unknown> | undefined;
  const participants = content.participants as Array<Record<string, unknown>> || [];

  const callerName = (caller?.name as string) || null;
  const callerPhone = (caller?.number as string) || null;

  // Extract recording IDs from caller and participants
  // GoTo API has multiple formats for recording IDs
  const recordingIds: string[] = [];

  // Format 1: caller.recordingId (summary webhook format)
  if (caller?.recordingId) {
    recordingIds.push(caller.recordingId as string);
  }

  for (const participant of participants) {
    // Format 2: participant.recordingId (older format)
    if (participant.recordingId) {
      recordingIds.push(participant.recordingId as string);
    }

    // Format 3: participant.recordings[].id (detailed report format)
    const recordings = participant.recordings as Array<{ id?: string }> | undefined;
    if (recordings && Array.isArray(recordings)) {
      for (const rec of recordings) {
        if (rec.id) {
          recordingIds.push(rec.id);
        }
      }
    }
  }

  // Remove duplicates
  const uniqueRecordingIds = [...new Set(recordingIds)];
  console.log("[GoTo Webhook] Found recording IDs:", uniqueRecordingIds);

  // Try to get recording URLs
  let recordingUrl: string | null = null;
  let transcript: string | null = null;

  for (const recordingId of uniqueRecordingIds) {
    if (recordingUrl) break; // Only need one recording URL
    try {
      console.log("[GoTo Webhook] Fetching recording URL for:", recordingId);
      recordingUrl = await getRecordingUrl(recordingId);
      console.log("[GoTo Webhook] Got recording URL:", recordingUrl);
    } catch (error) {
      console.error("[GoTo Webhook] Failed to get recording URL:", recordingId, error);
    }

    // Try to get transcription for this recording
    if (!transcript) {
      try {
        console.log("[GoTo Webhook] Fetching transcription for:", recordingId);
        const transcriptData = await getTranscription(recordingId);
        transcript = transcriptData.text;
        console.log("[GoTo Webhook] Got transcript:", transcript?.substring(0, 100));
      } catch (error) {
        console.error("[GoTo Webhook] Failed to get transcription:", recordingId, error);
      }
    }
  }

  // Extract GoTo's built-in AI analysis if available
  const gotoAiAnalysis = content.aiAnalysis as Record<string, unknown> | undefined;
  const gotoSummary = gotoAiAnalysis?.summary as string | undefined;
  const gotoSentiment = gotoAiAnalysis?.sentiment as string | undefined;
  const gotoTopics = gotoAiAnalysis?.topics as string[] | undefined;

  // Use our AI parsing for additional analysis if needed
  let parsedData: ParsedWebhookData | null = null;
  if (isAIParsingAvailable() && (transcript || !gotoSummary)) {
    parsedData = await parseWebhookWithAI({
      source: "goto_connect",
      type: "call_report",
      content,
      transcript,
      caller,
      participants,
    });
  }

  // Prefer GoTo's analysis, fallback to our AI, then generic
  const summary = gotoSummary || parsedData?.analysis?.summary || `GoTo Connect call - ${duration}s`;
  const sentiment = gotoSentiment?.toLowerCase() !== "unavailable" ? gotoSentiment?.toLowerCase() : (parsedData?.analysis?.sentiment || null);

  // Try to auto-match caller to an existing client
  const finalCallerPhone = callerPhone || parsedData?.contact?.phone || null;
  const matchedClientId = await matchPhoneToClient(finalCallerPhone);

  // Store call record
  const [insertedCall] = await db
    .insert(calls)
    .values({
      vapiCallId: `goto-${conversationSpaceId}`,
      clientId: matchedClientId,
      callerPhone: finalCallerPhone,
      callerName: callerName || parsedData?.contact?.name || null,
      status: "completed",
      direction,
      duration,
      transcription: transcript,
      summary,
      intent: parsedData?.analysis?.category || (gotoTopics?.length ? gotoTopics[0] : null),
      sentiment,
      recordingUrl,
      metadata: {
        sourceProvider: "goto",
        gotoConversationSpaceId: conversationSpaceId,
        gotoAccountKey: accountKey,
        callCreated,
        callEnded,
        callAnswered,
        caller,
        participants,
        recordingIds: uniqueRecordingIds,
        gotoAiAnalysis,
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
    description: `${direction === "inbound" ? "Inbound" : "Outbound"} GoTo Connect call${callerName ? ` with ${callerName}` : ""}${callerPhone ? ` (${callerPhone})` : ""} - ${duration}s`,
    metadata: {
      callId: recordId,
      gotoConversationSpaceId: conversationSpaceId,
      category: parsedData?.analysis?.category || null,
      urgency: parsedData?.analysis?.urgency || null,
      webhookLogId,
    },
  });

  // Auto-create tasks from AI suggested actions
  const suggestedActions = parsedData?.analysis?.suggestedActions || [];
  if (suggestedActions.length > 0 && recordId) {
    console.log("[GoTo Webhook] Creating tasks from suggested actions:", suggestedActions.length);

    for (const action of suggestedActions) {
      try {
        await db.insert(tasks).values({
          title: action,
          description: `AI-suggested task from call with ${callerName || callerPhone || "unknown caller"}`,
          status: "pending",
          priority: parsedData?.analysis?.urgency === "urgent" ? "urgent" :
                   parsedData?.analysis?.urgency === "high" ? "high" : "medium",
          source: "phone_call",
          sourceReferenceId: recordId,
          clientId: matchedClientId,
          metadata: {
            aiSuggested: true,
            aiConfidence: parsedData?.confidence || 0.8,
            aiSourceType: "call_analysis",
            callSummary: summary,
            callerPhone: finalCallerPhone,
            callerName,
          },
        });
      } catch (taskError) {
        console.error("[GoTo Webhook] Failed to create task:", action, taskError);
      }
    }

    console.log("[GoTo Webhook] Created", suggestedActions.length, "tasks from call");
  }

  return {
    id: recordId || "",
    callerPhone: finalCallerPhone,
    callerName,
    direction,
    duration,
    transcript,
    summary,
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

  // Try to auto-match caller to an existing client
  const finalCallerPhone = parsedData?.contact?.phone || callerPhone;
  const matchedClientId = await matchPhoneToClient(finalCallerPhone);

  // Store call record
  const [insertedCall] = await db
    .insert(calls)
    .values({
      vapiCallId: conversationSpaceId ? `goto-${conversationSpaceId}` : `goto-${Date.now()}`,
      clientId: matchedClientId,
      callerPhone: finalCallerPhone,
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
    callerPhone: finalCallerPhone,
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

  // Try to auto-match caller to an existing client
  const finalCallerPhone = parsedData.contact?.phone || null;
  const matchedClientId = await matchPhoneToClient(finalCallerPhone);

  const [insertedCall] = await db
    .insert(calls)
    .values({
      vapiCallId: `goto-unknown-${Date.now()}`,
      clientId: matchedClientId,
      callerPhone: finalCallerPhone,
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
    callerPhone: finalCallerPhone,
    callerName: parsedData.contact?.name || null,
    direction,
    duration: parsedData.call?.duration || null,
    transcript: parsedData.call?.transcript || null,
    summary: parsedData.analysis?.summary || null,
    recordingUrl: parsedData.call?.recordingUrl || null,
  };
}

/**
 * Process recording or transcription ready notifications
 * These are sent by GoTo when a recording/transcription becomes available for download
 */
async function processRecordingNotification(
  eventType: string,
  content: Record<string, unknown>,
  webhookLogId: string | null
): Promise<void> {
  const recordingId = content.recordingId as string | undefined;
  const transcriptId = content.transcriptId as string | undefined;
  const conversationSpaceId = content.conversationSpaceId as string | undefined;
  const callId = content.callId as string | undefined;

  console.log("[GoTo Webhook] Processing recording notification:", {
    eventType,
    recordingId,
    transcriptId,
    conversationSpaceId,
    callId,
  });

  if (!recordingId && !transcriptId) {
    console.log("[GoTo Webhook] No recording or transcript ID in notification");
    return;
  }

  // Try to find the associated call record
  let callToUpdate: { id: string } | null = null;

  // First try by conversationSpaceId
  if (conversationSpaceId) {
    const [found] = await db
      .select({ id: calls.id })
      .from(calls)
      .where(eq(calls.vapiCallId, `goto-${conversationSpaceId}`))
      .limit(1);
    callToUpdate = found || null;
  }

  // If not found by conversationSpaceId, try finding by recording ID in metadata
  if (!callToUpdate && recordingId) {
    const results = await db
      .select({ id: calls.id })
      .from(calls)
      .where(sql`${calls.metadata}::jsonb->'recordingIds' ? ${recordingId}`)
      .limit(1);
    callToUpdate = results[0] || null;
  }

  if (!callToUpdate) {
    console.log("[GoTo Webhook] Could not find call record to update for recording notification");
    return;
  }

  console.log("[GoTo Webhook] Found call to update:", callToUpdate.id);

  if (eventType === "RECORDING_READY" && recordingId) {
    // Get the recording URL and update the call
    try {
      const recordingUrl = await getRecordingUrl(recordingId);
      console.log("[GoTo Webhook] Got recording URL:", recordingUrl);

      await db
        .update(calls)
        .set({
          recordingUrl,
          metadata: sql`${calls.metadata}::jsonb || jsonb_build_object('recordingReady', true, 'recordingReadyAt', ${new Date().toISOString()})`,
        })
        .where(eq(calls.id, callToUpdate.id));

      console.log("[GoTo Webhook] Updated call with recording URL");
    } catch (error) {
      console.error("[GoTo Webhook] Failed to get recording URL:", error);
    }
  }

  if ((eventType === "TRANSCRIPTION_READY" || eventType === "RECORDING_READY") && (transcriptId || recordingId)) {
    // Try to get transcription
    const idToUse = transcriptId || recordingId;
    if (idToUse) {
      try {
        console.log("[GoTo Webhook] Fetching transcription for:", idToUse);
        const transcriptData = await getTranscription(idToUse);

        if (transcriptData.text) {
          await db
            .update(calls)
            .set({
              transcription: transcriptData.text,
              metadata: sql`${calls.metadata}::jsonb || jsonb_build_object('transcriptionReady', true, 'transcriptionReadyAt', ${new Date().toISOString()})`,
            })
            .where(eq(calls.id, callToUpdate.id));

          console.log("[GoTo Webhook] Updated call with transcription");
        }
      } catch (error) {
        console.error("[GoTo Webhook] Failed to get transcription:", error);
      }
    }
  }

  // Log activity
  await db.insert(activityLogs).values({
    type: "webhook_received",
    description: `GoTo ${eventType} notification processed for call ${callToUpdate.id}`,
    metadata: {
      callId: callToUpdate.id,
      recordingId,
      transcriptId,
      eventType,
      webhookLogId,
    },
  });
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
