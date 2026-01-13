import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decrypt } from "@/lib/shared/crypto";
import logger from "@/lib/logger";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

/**
 * POST /api/email-intelligence/backfill-body
 * Fetches and stores email body content for existing classifications that are missing it
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get user's email connections
    const { data: connections } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "microsoft");

    if (!connections || connections.length === 0) {
      return NextResponse.json({ error: "No email connections found" }, { status: 400 });
    }

    let totalUpdated = 0;
    let totalFailed = 0;

    for (const connection of connections) {
      // Get emails missing body content
      const { data: emailsWithoutBody } = await supabase
        .from("email_classifications")
        .select("id, email_message_id")
        .eq("account_id", connection.id)
        .is("body_text", null)
        .limit(50);

      if (!emailsWithoutBody || emailsWithoutBody.length === 0) {
        continue;
      }

      logger.info(`[Backfill] Found ${emailsWithoutBody.length} emails without body for account ${connection.email}`);

      // Decrypt access token
      const accessToken = decrypt(connection.access_token);

      // Fetch body for each email
      for (const email of emailsWithoutBody) {
        try {
          const response = await fetch(
            `${MICROSOFT_GRAPH_URL}/me/messages/${email.email_message_id}?$select=body,bodyPreview`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (!response.ok) {
            logger.error(`[Backfill] Failed to fetch email ${email.email_message_id}:`, new Error(await response.text()));
            totalFailed++;
            continue;
          }

          const emailData = await response.json();

          // Extract plain text from HTML body
          const bodyHtml = emailData.body?.content || "";
          const bodyPreview = emailData.bodyPreview || "";
          const bodyText = bodyHtml
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/\s+/g, " ")
            .trim();

          // Update the email classification with body content
          const { error: updateError } = await supabase
            .from("email_classifications")
            .update({
              body_text: bodyText,
              body_preview: bodyPreview,
              body_html: bodyHtml,
            })
            .eq("id", email.id);

          if (updateError) {
            logger.error(`[Backfill] Failed to update email ${email.id}:`, updateError);
            totalFailed++;
          } else {
            totalUpdated++;
          }
        } catch (error) {
          logger.error(`[Backfill] Error processing email ${email.email_message_id}:`, error);
          totalFailed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: totalUpdated,
      failed: totalFailed,
    });
  } catch (error) {
    logger.error("[Backfill] Error:", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}
