/**
 * Microsoft Graph Webhook Notifications Handler
 * Receives real-time email notifications from Microsoft Graph
 *
 * @route POST /api/emails/webhooks/notifications - Handle notifications
 * @route GET /api/emails/webhooks/notifications - Validation endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET - Microsoft Graph webhook validation
 * When creating a subscription, Microsoft sends a validation request
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const validationToken = searchParams.get("validationToken");

  if (validationToken) {
    // Return the validation token as plain text
    return new NextResponse(validationToken, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.json({ error: "No validation token" }, { status: 400 });
}

/**
 * POST - Handle webhook notifications
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Microsoft sends an array of notifications
    const notifications = body.value || [];

    const supabase = await createClient();

    for (const notification of notifications) {
      const { clientState, subscriptionId, resource, changeType } = notification;

      // Verify clientState matches a user ID
      const userId = clientState;

      if (!userId) {
        console.error("Invalid clientState in notification");
        continue;
      }

      // Verify subscription exists
      const { data: syncState } = await supabase
        .from("email_sync_state")
        .select("*")
        .eq("user_id", userId)
        .eq("webhook_subscription_id", subscriptionId)
        .single();

      if (!syncState) {
        console.error("Subscription not found:", subscriptionId);
        continue;
      }

      // Update last webhook received time
      await supabase
        .from("email_sync_state")
        .update({
          last_webhook_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", syncState.id);

      // Trigger background sync for this user
      // In a production app, you would queue this in a job system (Inngest, BullMQ, etc.)
      console.log(`[Webhook] New email notification for user ${userId}:`, {
        resource,
        changeType,
      });

      // Could trigger sync here or use Supabase Realtime to notify the client
      // For simplicity, we'll just log it and rely on client polling
    }

    // Always return 202 Accepted to Microsoft
    return NextResponse.json({ status: "accepted" }, { status: 202 });
  } catch (error) {
    console.error("[Webhook] Error handling notification:", error);
    // Still return 202 to avoid subscription failures
    return NextResponse.json({ status: "error" }, { status: 202 });
  }
}
