import { NextRequest, NextResponse } from "next/server";
import { verifyCallWebhookSignature, isTimestampValid, generateIdempotencyKey } from "@/lib/shared/webhook";
import { parseWebhookWithAI, isAIParsingAvailable, detectSourceType } from "@/lib/ai";
import { db } from "@/db";
import { calls, activityLogs } from "@/db/schema";
import type { ParsedWebhookData } from "@/lib/ai";

// Store processed webhook IDs to prevent replay (in production, use Redis or database)
const processedWebhooks = new Set<string>();
const MAX_PROCESSED_WEBHOOKS = 10000;

/**
 * Generic Webhook Endpoint
 *
 * This endpoint accepts ANY JSON payload from any source:
 * - Phone call providers (VAPI, Twilio, Bland.ai, etc.)
 * - Web forms (Typeform, JotForm, custom forms)
 * - Other integrations
 *
 * The AI parser will intelligently extract structured data from the payload.
 */
export async function POST(request: NextRequest) {
  try {
    // Get the raw body
    const rawBody = await request.text();

    // Verify webhook signature (if configured)
    const signature = request.headers.get("x-webhook-signature") ||
                     request.headers.get("x-signature") ||
                     request.headers.get("authorization");
    const verification = verifyCallWebhookSignature(rawBody, signature);

    if (!verification.valid) {
      console.error("[Webhook] Signature verification failed:", verification.error);
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Try to parse as JSON
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody);
    } catch {
      // If not JSON, wrap in a data object
      data = { raw: rawBody };
    }

    // Check for replay attacks using event_id and timestamp
    const eventId = (data.event_id || data.id || data.callId || `auto-${Date.now()}`) as string;
    const timestamp = (data.timestamp || data.created_at || Date.now()) as string | number;

    // Verify timestamp is recent (within 5 minutes)
    if (data.timestamp && !isTimestampValid(timestamp)) {
      console.error("[Webhook] Timestamp expired");
      return NextResponse.json(
        { error: "Webhook timestamp expired" },
        { status: 400 }
      );
    }

    // Check idempotency - prevent processing same webhook twice
    const idempotencyKey = generateIdempotencyKey(eventId, timestamp);
    if (processedWebhooks.has(idempotencyKey)) {
      console.log("[Webhook] Duplicate webhook ignored:", idempotencyKey);
      return NextResponse.json({
        success: true,
        message: "Webhook already processed",
        duplicate: true,
      });
    }

    // Add to processed set (with cleanup)
    processedWebhooks.add(idempotencyKey);
    if (processedWebhooks.size > MAX_PROCESSED_WEBHOOKS) {
      const firstItem = processedWebhooks.values().next().value;
      if (firstItem) {
        processedWebhooks.delete(firstItem);
      }
    }

    // Validate that we have some data
    if (!data || Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "Empty payload" },
        { status: 400 }
      );
    }

    // Quick source detection for logging
    const quickSourceType = detectSourceType(data);
    console.log(`[Webhook] Received ${quickSourceType} data:`, JSON.stringify(data, null, 2));

    // Parse webhook with AI if available
    let parsedData: ParsedWebhookData | null = null;

    if (isAIParsingAvailable()) {
      console.log("[Webhook] AI parsing available, processing payload...");
      parsedData = await parseWebhookWithAI(data);
      console.log("[Webhook] AI parsed data:", JSON.stringify(parsedData, null, 2));
    } else {
      console.warn("[Webhook] OPENAI_API_KEY not configured, skipping AI parsing");
    }

    // Store in database based on source type
    let recordId: string | null = null;

    if (parsedData) {
      if (parsedData.source === "phone_call" && parsedData.call) {
        // Store phone call record
        const [insertedCall] = await db.insert(calls).values({
          vapiCallId: (data.call_id || data.callId || data.id || eventId) as string,
          callerPhone: parsedData.contact.phone || null,
          callerName: parsedData.contact.name || parsedData.contact.firstName
            ? `${parsedData.contact.firstName || ""} ${parsedData.contact.lastName || ""}`.trim()
            : null,
          status: "completed",
          direction: parsedData.call.direction || "inbound",
          duration: parsedData.call.duration || null,
          transcription: parsedData.call.transcript || null,
          summary: parsedData.analysis.summary || parsedData.call.summary || null,
          intent: parsedData.analysis.category || null,
          sentiment: parsedData.analysis.sentiment || null,
          recordingUrl: parsedData.call.recordingUrl || null,
          metadata: {
            sourceProvider: parsedData.sourceProvider,
            analysis: parsedData.analysis,
            rawPayload: parsedData.rawPayload,
            parsedAt: parsedData.parsedAt,
            confidence: parsedData.confidence,
          },
        }).returning({ id: calls.id });

        recordId = insertedCall?.id || null;

        // Log activity
        await db.insert(activityLogs).values({
          type: parsedData.call.direction === "inbound" ? "call_received" : "call_made",
          description: `${parsedData.call.direction === "inbound" ? "Inbound" : "Outbound"} call from ${parsedData.contact.phone || "unknown"} - ${parsedData.analysis.summary}`,
          metadata: {
            callId: recordId,
            category: parsedData.analysis.category,
            urgency: parsedData.analysis.urgency,
          },
        });

      } else if (parsedData.source === "web_form" && parsedData.form) {
        // For web forms, store as a call record with special handling
        // This could be extended to a separate forms table
        const [insertedCall] = await db.insert(calls).values({
          vapiCallId: `form-${eventId}`,
          callerPhone: parsedData.contact.phone || null,
          callerName: parsedData.contact.name || parsedData.contact.firstName
            ? `${parsedData.contact.firstName || ""} ${parsedData.contact.lastName || ""}`.trim()
            : null,
          status: "completed",
          direction: "inbound",
          duration: 0,
          transcription: JSON.stringify(parsedData.form.fields, null, 2),
          summary: parsedData.analysis.summary || `Web form submission: ${parsedData.form.formName || "Unknown form"}`,
          intent: parsedData.analysis.category || "web_form",
          sentiment: parsedData.analysis.sentiment || null,
          metadata: {
            source: "web_form",
            formName: parsedData.form.formName,
            sourceProvider: parsedData.sourceProvider,
            analysis: parsedData.analysis,
            formFields: parsedData.form.fields,
            rawPayload: parsedData.rawPayload,
            parsedAt: parsedData.parsedAt,
            confidence: parsedData.confidence,
          },
        }).returning({ id: calls.id });

        recordId = insertedCall?.id || null;

        // Log activity
        await db.insert(activityLogs).values({
          type: "form_submission",
          description: `Web form submission from ${parsedData.contact.name || parsedData.contact.email || "unknown"} - ${parsedData.analysis.summary}`,
          metadata: {
            callId: recordId,
            formName: parsedData.form.formName,
            category: parsedData.analysis.category,
            urgency: parsedData.analysis.urgency,
          },
        });

      } else {
        // Unknown source - still store with minimal data
        const [insertedCall] = await db.insert(calls).values({
          vapiCallId: `unknown-${eventId}`,
          callerPhone: parsedData.contact.phone || null,
          callerName: parsedData.contact.name || null,
          status: "completed",
          direction: "inbound",
          summary: parsedData.analysis.summary || "Unknown webhook source",
          intent: parsedData.analysis.category || "other",
          sentiment: parsedData.analysis.sentiment || null,
          metadata: {
            source: parsedData.source,
            sourceProvider: parsedData.sourceProvider,
            analysis: parsedData.analysis,
            rawPayload: parsedData.rawPayload,
            parsedAt: parsedData.parsedAt,
            confidence: parsedData.confidence,
          },
        }).returning({ id: calls.id });

        recordId = insertedCall?.id || null;

        // Log activity
        await db.insert(activityLogs).values({
          type: "webhook_received",
          description: `Webhook received from ${parsedData.sourceProvider || "unknown source"} - ${parsedData.analysis.summary}`,
          metadata: {
            callId: recordId,
            source: parsedData.source,
            category: parsedData.analysis.category,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      recordId,
      source: parsedData?.source || quickSourceType,
      aiParsed: !!parsedData,
      analysis: parsedData?.analysis || null,
    });
  } catch (error) {
    console.error("[Webhook] Error processing webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Support GET for webhook verification (some services require this)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Handle verification challenges
  const challenge = searchParams.get("challenge") || searchParams.get("hub.challenge");
  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({
    status: "healthy",
    endpoint: "/api/webhooks/calls",
    description: "AI Phone Agent webhook endpoint",
    supportedMethods: ["POST"],
    examplePayload: {
      caller_phone: "+1234567890",
      caller_name: "John Doe",
      transcript: "Call transcript text...",
      recording_url: "https://...",
      duration: 120,
      timestamp: new Date().toISOString(),
    },
  });
}
