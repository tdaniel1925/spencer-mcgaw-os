/**
 * Microsoft Graph Webhook Subscription API
 * Subscribe to email notifications for real-time sync
 *
 * @route POST /api/emails/webhooks/subscribe
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";

const WEBHOOK_URL = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/emails/webhooks/notifications`
  : "https://your-app.vercel.app/api/emails/webhooks/notifications";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const graphService = await GraphEmailService.fromConnection(user.id);
    if (!graphService) {
      return NextResponse.json(
        { error: "Email not connected", needsConnection: true },
        { status: 400 }
      );
    }

    // Create subscription using Microsoft Graph
    // Subscriptions expire after 3 days max for /me/mailFolders resources
    const expirationDateTime = new Date();
    expirationDateTime.setDate(expirationDateTime.getDate() + 2); // 2 days

    const subscriptionRequest = {
      changeType: "created,updated", // Notify on new emails and updates
      notificationUrl: WEBHOOK_URL,
      resource: "/me/mailFolders('inbox')/messages",
      expirationDateTime: expirationDateTime.toISOString(),
      clientState: user.id, // Use user ID as secret for validation
    };

    // Note: This requires the webhook endpoint to be publicly accessible
    // and to respond to validation requests
    const response = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${(graphService as any).accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subscriptionRequest),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Subscription error:", error);
      return NextResponse.json(
        { error: "Failed to create subscription", details: error },
        { status: response.status }
      );
    }

    const subscription = await response.json();

    // Store subscription info in database
    await supabase.from("email_sync_state").upsert(
      {
        user_id: user.id,
        connection_id: (await supabase
          .from("email_connections")
          .select("id")
          .eq("user_id", user.id)
          .eq("provider", "microsoft")
          .single()
        ).data?.id,
        webhook_subscription_id: subscription.id,
        webhook_expires_at: subscription.expirationDateTime,
        webhook_sub_status: "active",
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id,connection_id",
      }
    );

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        expiresAt: subscription.expirationDateTime,
      },
    });
  } catch (error) {
    console.error("[API] Error creating webhook subscription:", error);
    return NextResponse.json({ error: "Failed to create subscription" }, { status: 500 });
  }
}
