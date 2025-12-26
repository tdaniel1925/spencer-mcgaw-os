import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { calls, activityLogs, webhookLogs, clients } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { parseWebhookWithAI, isAIParsingAvailable } from "@/lib/ai";
import type { ParsedWebhookData } from "@/lib/ai";
import { getCallReport, getRecordingUrl, getTranscription } from "@/lib/goto";
import { enrichCallerName, isTwilioLookupAvailable } from "@/lib/twilio";
import { eq, or, sql } from "drizzle-orm";
import crypto from "crypto";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants";
import logger from "@/lib/logger";

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
      return matchedClients[0].id;
    }
  } catch (error) {
    logger.error("[GoTo Webhook] Error matching phone to client:", error);
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
      logger.error("[GoTo Webhook] Invalid signature");
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
      logger.error("[GoTo Webhook] Failed to parse JSON payload");
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400 }
      );
    }

    // Extract event info from GoTo Connect notification structure
    // GoTo sends: { data: { source: "...", type: "...", timestamp: "...", content: {...} } }
    const notificationData = (data.data || data) as Record<string, unknown>;
    const source = notificationData.source as string | undefined;
    const topLevelType = notificationData.type as string | undefined;
    const content = (notificationData.content || {}) as Record<string, unknown>;

    // For call-state events, the actual event type (STARTING, ACTIVE, ENDING) is in content.state.type
    const stateData = content.state as Record<string, unknown> | undefined;
    const eventType = (topLevelType === "call-state" && stateData?.type)
      ? (stateData.type as string)
      : topLevelType;

    // Generate unique event ID for idempotency
    const eventId =
      (content.conversationSpaceId as string) ||
      (content.callId as string) ||
      (data.id as string) ||
      `goto-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Check for duplicate processing
    if (processedWebhooks.has(eventId)) {
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
      logger.error("[GoTo Webhook] Failed to create webhook log:", logError);
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

    return NextResponse.json({
      success: true,
      message: "GoTo Connect webhook processed successfully",
      recordId: callRecord?.id,
      eventId,
      eventType,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("[GoTo Webhook] Error processing webhook:", error);

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

  // Extract data directly from webhook content (more complete than API fetch)
  const callCreated = content.callCreated as string || new Date().toISOString();
  const callEnded = content.callEnded as string || new Date().toISOString();
  const callAnswered = content.callAnswered as string | undefined;
  const accountKey = content.accountKey as string || "";

  // Calculate duration from timestamps
  const startTime = new Date(callAnswered || callCreated);
  const endTime = new Date(callEnded);
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

  // Extract caller info from the webhook content
  const caller = content.caller as Record<string, unknown> | undefined;
  const participants = content.participants as Array<Record<string, unknown>> || [];

  // Determine direction from GoTo data
  // Primary: use the direction field from GoTo (case-insensitive)
  // Fallback 1: check caller.type.value - LINE = outbound (internal), PHONE_NUMBER = inbound (external)
  // Fallback 2: check if caller has lineId (internal user making outbound call)
  const rawDirection = content.direction as string | undefined;
  const callerType = (caller?.type as Record<string, unknown>)?.value as string | undefined;
  const callerHasLineId = !!(caller?.type as Record<string, unknown>)?.lineId;

  let direction: "inbound" | "outbound";

  if (rawDirection) {
    direction = rawDirection.toUpperCase() === "OUTBOUND" ? "outbound" : "inbound";
  } else if (callerType === "LINE" || callerHasLineId) {
    // Caller is an internal LINE user making an outbound call
    direction = "outbound";
  } else if (callerType === "PHONE_NUMBER") {
    // Caller is an external phone number - inbound call
    direction = "inbound";
  } else {
    // Default to inbound if we can't determine
    direction = "inbound";
  }

  const rawCallerName = (caller?.name as string) || null;
  const callerPhone = (caller?.number as string) || null;

  // Enrich caller name using Twilio Lookup if name is missing or just a phone number
  let callerName = rawCallerName;
  let twilioCallerType: "BUSINESS" | "CONSUMER" | null = null;
  let callerEnriched = false;

  if (callerPhone && isTwilioLookupAvailable()) {
    const enriched = await enrichCallerName(callerPhone, rawCallerName);
    callerName = enriched.name;
    twilioCallerType = enriched.type;
    callerEnriched = enriched.enriched;
  }

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

  // Try to get recording URLs
  let recordingUrl: string | null = null;
  let transcript: string | null = null;

  for (const recordingId of uniqueRecordingIds) {
    if (recordingUrl) break; // Only need one recording URL
    try {
      recordingUrl = await getRecordingUrl(recordingId);
    } catch (error) {
      logger.error("[GoTo Webhook] Failed to get recording URL:", error, { recordingId });
    }

    // Try to get transcription for this recording
    if (!transcript) {
      try {
        const transcriptData = await getTranscription(recordingId);
        transcript = transcriptData.text;
      } catch (error) {
        logger.error("[GoTo Webhook] Failed to get transcription:", error, { recordingId });
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
      // Pass the determined direction so AI uses correct context for summary
      determined_direction: direction,
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

  // Check if call already exists (GoTo sends multiple webhooks for same call)
  const vapiCallIdValue = `goto-${conversationSpaceId}`;
  const [existingCall] = await db
    .select({ id: calls.id })
    .from(calls)
    .where(eq(calls.vapiCallId, vapiCallIdValue))
    .limit(1);

  let recordId: string | null = null;

  if (existingCall) {
    // Call already exists, update it with latest data
    recordId = existingCall.id;

    await db
      .update(calls)
      .set({
        transcription: transcript || undefined,
        summary: summary || undefined,
        recordingUrl: recordingUrl || undefined,
        duration,
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
          twilioEnriched: callerEnriched,
          twilioCallerType,
          rawCallerName,
          webhookLogId,
        },
      })
      .where(eq(calls.id, existingCall.id));
  } else {
    // Insert new call
    const [insertedCall] = await db
      .insert(calls)
      .values({
        vapiCallId: vapiCallIdValue,
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
          twilioEnriched: callerEnriched,
          twilioCallerType,
          rawCallerName,
          webhookLogId,
        },
      })
      .returning({ id: calls.id });

    recordId = insertedCall?.id || null;
  }

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

  // Auto-create tasks from AI suggested actions using Supabase
  const suggestedActions = parsedData?.analysis?.suggestedActions || [];
  if (suggestedActions.length > 0 && recordId) {
    const supabase = await createClient();

    // Check if tasks already exist for this call (prevent duplicates on webhook retries)
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("id, title")
      .eq("source_call_id", recordId);

    const existingTaskTitles = new Set((existingTasks || []).map(t => t.title));

    let tasksCreated = 0;
    for (const action of suggestedActions) {
      // Skip if task with same title already exists for this call
      if (existingTaskTitles.has(action)) {
        continue;
      }

      try {
        const { data: newTask, error: taskError } = await supabase
          .from("tasks")
          .insert({
            title: action,
            description: `AI-suggested task from call with ${callerName || callerPhone || "unknown caller"}.\n\nCall Summary: ${summary || "Not available"}`,
            status: "pending",
            priority: parsedData?.analysis?.urgency === "urgent" ? "urgent" :
                     parsedData?.analysis?.urgency === "high" ? "high" : "medium",
            source_type: "phone_call",
            source_call_id: recordId, // Use proper foreign key
            client_id: matchedClientId,
            source_metadata: {
              conversation_space_id: conversationSpaceId,
              caller_phone: finalCallerPhone,
              caller_name: callerName,
            },
            ai_confidence: parsedData?.confidence || 0.8,
            ai_extracted_data: {
              ai_suggested: true,
              source_type: "call_analysis",
              urgency: parsedData?.analysis?.urgency,
              category: parsedData?.analysis?.category,
              call_summary: summary,
            },
            organization_id: DEFAULT_ORGANIZATION_ID,
          })
          .select("id")
          .single();

        if (taskError) {
          logger.error("[GoTo Webhook] Failed to create task:", taskError, { action: action.substring(0, 50) });
        } else {
          tasksCreated++;
        }
      } catch (taskError) {
        logger.error("[GoTo Webhook] Exception creating task:", taskError, { action: action.substring(0, 50) });
      }
    }
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
  const state = (content.state || fullData.state) as Record<string, unknown> | undefined;
  const metadata = (content.metadata || fullData.metadata) as Record<string, unknown> | undefined;

  // conversationSpaceId is in state.id for call-state events
  const conversationSpaceId = (state?.id as string) || (content.conversationSpaceId as string);

  const direction: "inbound" | "outbound" =
    (state?.direction as string)?.toLowerCase() === "outbound" ? "outbound" : "inbound";

  // Extract caller phone from various possible locations
  const callerPhone =
    (state?.originator as string) ||
    (metadata?.callerNumber as string) ||
    (state?.parties as Array<Record<string, unknown>>)?.find(p => p.isOriginator || p.originator)?.phoneNumber as string ||
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

  // Enrich caller name using Twilio Lookup if name is missing
  const rawName = parsedData?.contact?.name || null;
  let enrichedCallerName = rawName;
  let eventTwilioCallerType: "BUSINESS" | "CONSUMER" | null = null;
  let eventCallerEnriched = false;

  if (finalCallerPhone && isTwilioLookupAvailable()) {
    const enriched = await enrichCallerName(finalCallerPhone, rawName);
    enrichedCallerName = enriched.name;
    eventTwilioCallerType = enriched.type;
    eventCallerEnriched = enriched.enriched;
  }

  // Store call record
  const [insertedCall] = await db
    .insert(calls)
    .values({
      vapiCallId: conversationSpaceId ? `goto-${conversationSpaceId}` : `goto-${Date.now()}`,
      clientId: matchedClientId,
      callerPhone: finalCallerPhone,
      callerName: enrichedCallerName,
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
        twilioEnriched: eventCallerEnriched,
        twilioCallerType: eventTwilioCallerType,
        rawCallerName: rawName,
        webhookLogId,
      },
    })
    .returning({ id: calls.id });

  const recordId = insertedCall?.id || null;

  // Log activity
  await db.insert(activityLogs).values({
    type: direction === "inbound" ? "call_received" : "call_made",
    description: `${direction === "inbound" ? "Inbound" : "Outbound"} GoTo Connect call ended${enrichedCallerName ? ` with ${enrichedCallerName}` : ""}${callerPhone ? ` (${callerPhone})` : ""}`,
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
    callerName: enrichedCallerName,
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
    return null;
  }

  const direction: "inbound" | "outbound" =
    parsedData.call?.direction || "inbound";

  // Try to auto-match caller to an existing client
  const finalCallerPhone = parsedData.contact?.phone || null;
  const matchedClientId = await matchPhoneToClient(finalCallerPhone);

  // Enrich caller name using Twilio Lookup if name is missing
  const unknownRawName = parsedData.contact?.name || null;
  let unknownEnrichedName = unknownRawName;
  let unknownTwilioCallerType: "BUSINESS" | "CONSUMER" | null = null;
  let unknownCallerEnriched = false;

  if (finalCallerPhone && isTwilioLookupAvailable()) {
    const enriched = await enrichCallerName(finalCallerPhone, unknownRawName);
    unknownEnrichedName = enriched.name;
    unknownTwilioCallerType = enriched.type;
    unknownCallerEnriched = enriched.enriched;
  }

  const [insertedCall] = await db
    .insert(calls)
    .values({
      vapiCallId: `goto-unknown-${Date.now()}`,
      clientId: matchedClientId,
      callerPhone: finalCallerPhone,
      callerName: unknownEnrichedName,
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
        twilioEnriched: unknownCallerEnriched,
        twilioCallerType: unknownTwilioCallerType,
        rawCallerName: unknownRawName,
        webhookLogId,
      },
    })
    .returning({ id: calls.id });

  return {
    id: insertedCall?.id || "",
    callerPhone: finalCallerPhone,
    callerName: unknownEnrichedName,
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

  if (!recordingId && !transcriptId) {
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
    return;
  }

  if (eventType === "RECORDING_READY" && recordingId) {
    // Get the recording URL and update the call
    try {
      const recordingUrl = await getRecordingUrl(recordingId);

      await db
        .update(calls)
        .set({
          recordingUrl,
          metadata: sql`${calls.metadata}::jsonb || jsonb_build_object('recordingReady', true, 'recordingReadyAt', ${new Date().toISOString()})`,
        })
        .where(eq(calls.id, callToUpdate.id));
    } catch (error) {
      logger.error("[GoTo Webhook] Failed to get recording URL:", error);
    }
  }

  if ((eventType === "TRANSCRIPTION_READY" || eventType === "RECORDING_READY") && (transcriptId || recordingId)) {
    // Try to get transcription
    const idToUse = transcriptId || recordingId;
    if (idToUse) {
      try {
        const transcriptData = await getTranscription(idToUse);

        if (transcriptData.text) {
          await db
            .update(calls)
            .set({
              transcription: transcriptData.text,
              metadata: sql`${calls.metadata}::jsonb || jsonb_build_object('transcriptionReady', true, 'transcriptionReadyAt', ${new Date().toISOString()})`,
            })
            .where(eq(calls.id, callToUpdate.id));
        }
      } catch (error) {
        logger.error("[GoTo Webhook] Failed to get transcription:", error);
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
