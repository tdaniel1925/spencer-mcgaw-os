import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyEmailWithAI } from "@/lib/email/ai-classifier";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// Helper to refresh access token if expired
async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
} | null> {
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;

  if (!clientId || !clientSecret) return null;

  try {
    const response = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: "refresh_token",
        }),
      }
    );

    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get email connections
    const { data: connections, error: connError } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id);

    if (connError || !connections || connections.length === 0) {
      return NextResponse.json(
        { error: "No email accounts connected", needsConnection: true },
        { status: 400 }
      );
    }

    let totalProcessed = 0;
    let totalFailed = 0;

    for (const connection of connections) {
      if (connection.provider !== "microsoft") continue;

      let accessToken = connection.access_token;

      // Check if token is expired
      if (new Date(connection.expires_at) <= new Date()) {
        const newTokens = await refreshAccessToken(connection.refresh_token);
        if (!newTokens) {
          console.error("Failed to refresh token for connection:", connection.id);
          continue;
        }

        // Update tokens in database
        accessToken = newTokens.access_token;
        await supabase
          .from("email_connections")
          .update({
            access_token: newTokens.access_token,
            refresh_token: newTokens.refresh_token,
            expires_at: new Date(Date.now() + newTokens.expires_in * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);
      }

      // Fetch recent emails
      const response = await fetch(
        `${MICROSOFT_GRAPH_URL}/me/mailFolders/inbox/messages?$top=20&$orderby=receivedDateTime desc&$select=id,subject,bodyPreview,body,from,toRecipients,receivedDateTime,isRead,hasAttachments,importance`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error("Failed to fetch emails:", await response.text());
        continue;
      }

      const data = await response.json();
      const emails = data.value || [];

      // Process each email with AI
      for (const email of emails) {
        try {
          // Check if already processed
          const { data: existing } = await supabase
            .from("email_classifications")
            .select("id")
            .eq("email_message_id", email.id)
            .single();

          if (existing) {
            // Already processed
            continue;
          }

          // Classify with AI
          const classification = await classifyEmailWithAI({
            id: email.id,
            from: {
              name: email.from?.emailAddress?.name || "Unknown",
              email: email.from?.emailAddress?.address || "",
            },
            to: email.toRecipients?.map((r: any) => ({
              name: r.emailAddress?.name || "",
              email: r.emailAddress?.address || "",
            })) || [],
            subject: email.subject || "(No Subject)",
            body: email.body?.content || email.bodyPreview || "",
            bodyPreview: email.bodyPreview || "",
            receivedAt: new Date(email.receivedDateTime),
            hasAttachments: email.hasAttachments,
          });

          // Store classification
          await supabase.from("email_classifications").insert({
            email_message_id: email.id,
            category: classification.category,
            subcategory: classification.subcategory,
            is_business_relevant: classification.isBusinessRelevant,
            priority_score: classification.priorityScore,
            priority_factors: classification.priorityFactors,
            sentiment: classification.sentiment,
            urgency: classification.urgency,
            requires_response: classification.requiresResponse,
            response_deadline: classification.responseDeadline,
            summary: classification.summary,
            key_points: classification.keyPoints,
            extracted_dates: classification.extractedEntities.dates.map((d) => new Date(d.value)),
            extracted_amounts: classification.extractedEntities.amounts.map((a) => a.value),
            extracted_document_types: classification.extractedEntities.documentTypes,
            extracted_names: classification.extractedEntities.names,
            assignment_reason: classification.suggestedAssignment?.reason,
            suggested_column: classification.suggestedAssignment?.suggestedColumn,
            draft_response: classification.draftResponse?.body,
            model_used: classification.modelUsed,
            confidence: classification.confidence,
            processing_time_ms: classification.processingTimeMs,
            tokens_used: classification.tokensUsed,
          });

          // Store action items
          for (const actionItem of classification.actionItems) {
            await supabase.from("email_action_items").insert({
              email_message_id: email.id,
              title: actionItem.title,
              description: actionItem.description,
              action_type: actionItem.type,
              mentioned_date: actionItem.dueDate ? new Date(actionItem.dueDate) : null,
              priority: actionItem.priority,
              confidence: actionItem.confidence,
              status: "pending",
            });
          }

          totalProcessed++;
        } catch (error) {
          console.error("Error processing email:", email.id, error);
          totalFailed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      failed: totalFailed,
    });
  } catch (error) {
    console.error("Error in sync:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
