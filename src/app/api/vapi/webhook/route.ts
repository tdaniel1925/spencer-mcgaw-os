import { NextRequest, NextResponse } from "next/server";
import { processWebhook, WebhookPayload } from "@/lib/vapi";

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
    const payload: WebhookPayload = await request.json();

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
