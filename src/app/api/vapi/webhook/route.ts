import { NextRequest, NextResponse } from "next/server";
import { processWebhook, WebhookPayload } from "@/lib/vapi";
import { verifyVapiSignature, isTimestampValid } from "@/lib/shared/webhook";

/**
 * VAPI Webhook Endpoint
 *
 * Configure this URL in your VAPI dashboard:
 * https://your-domain.com/api/vapi/webhook
 *
 * This endpoint receives real-time events from VAPI during calls.
 */
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();

    // Verify webhook signature (if configured)
    const signature = request.headers.get("x-vapi-signature") ||
                     request.headers.get("x-webhook-signature");
    const verification = verifyVapiSignature(rawBody, signature);

    if (!verification.valid) {
      console.error("VAPI Webhook signature verification failed:", verification.error);
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      );
    }

    // Parse payload
    const payload: WebhookPayload = JSON.parse(rawBody);

    // Verify timestamp to prevent replay attacks (if timestamp is provided)
    if (payload.timestamp && !isTimestampValid(payload.timestamp)) {
      console.error("VAPI Webhook timestamp expired");
      return NextResponse.json(
        { error: "Webhook timestamp expired" },
        { status: 400 }
      );
    }

    console.log("VAPI Webhook received:", {
      type: payload.type,
      callId: payload.call?.id,
    });

    const result = await processWebhook(payload);

    return NextResponse.json(result);
  } catch (error) {
    console.error("VAPI Webhook Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Verify webhook is accessible
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "VAPI webhook endpoint is active",
    timestamp: new Date().toISOString(),
  });
}
