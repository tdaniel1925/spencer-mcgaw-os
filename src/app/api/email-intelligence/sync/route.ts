import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyEmailWithAI } from "@/lib/email/ai-classifier";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants";
import { decrypt, encrypt } from "@/lib/shared/crypto";
import logger from "@/lib/logger";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// Map email action item types to TaskPool action type codes
const ACTION_TYPE_MAP: Record<string, string> = {
  response: "RESPOND",
  document: "PREPARE",
  calendar: "SCHEDULE",
  task: "PROCESS",
  call: "RESPOND",
  review: "REVIEW",
};

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
    let totalTasksCreated = 0;

    for (const connection of connections) {
      if (connection.provider !== "microsoft") continue;

      // Decrypt stored tokens
      let accessToken = decrypt(connection.access_token);

      // Check if token is expired
      if (new Date(connection.expires_at) <= new Date()) {
        const decryptedRefreshToken = decrypt(connection.refresh_token);
        const newTokens = await refreshAccessToken(decryptedRefreshToken);
        if (!newTokens) {
          logger.error("Failed to refresh token for connection", undefined, { connectionId: connection.id });
          continue;
        }

        // Update tokens in database (encrypt before storing)
        accessToken = newTokens.access_token;
        await supabase
          .from("email_connections")
          .update({
            access_token: encrypt(newTokens.access_token),
            refresh_token: encrypt(newTokens.refresh_token),
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
        logger.error("Failed to fetch emails", new Error(await response.text()));
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

          // Store classification with account_id for proper cleanup on disconnect
          // Also store email metadata (sender, subject, etc.) for display
          await supabase.from("email_classifications").insert({
            email_message_id: email.id,
            account_id: connection.id,
            // Email metadata
            sender_name: email.from?.emailAddress?.name || "Unknown",
            sender_email: email.from?.emailAddress?.address || "",
            subject: email.subject || "(No Subject)",
            has_attachments: email.hasAttachments || false,
            received_at: new Date(email.receivedDateTime).toISOString(),
            // Classification data
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

          // Store action items AND create TaskPool tasks
          // First, get the action types from TaskPool
          const { data: actionTypes } = await supabase
            .from("task_action_types")
            .select("id, code")
            .eq("is_active", true);

          const actionTypeByCode: Record<string, string> = {};
          (actionTypes || []).forEach((at: { id: string; code: string }) => {
            actionTypeByCode[at.code] = at.id;
          });

          // Try to match client from email sender
          let matchedClientId: string | null = null;
          const senderEmail = email.from?.emailAddress?.address;
          if (senderEmail) {
            const { data: clientMatch } = await supabase
              .from("client_contacts")
              .select("id")
              .eq("email", senderEmail)
              .single();
            if (clientMatch) {
              matchedClientId = clientMatch.id;
            }
          }

          // Also try to match by extracted names
          if (!matchedClientId && classification.extractedEntities.names.length > 0) {
            for (const nameObj of classification.extractedEntities.names) {
              const nameParts = nameObj.name.split(" ");
              if (nameParts.length >= 2) {
                const { data: clientMatch } = await supabase
                  .from("client_contacts")
                  .select("id")
                  .ilike("first_name", `%${nameParts[0]}%`)
                  .ilike("last_name", `%${nameParts.slice(1).join(" ")}%`)
                  .single();
                if (clientMatch) {
                  matchedClientId = clientMatch.id;
                  break;
                }
              }
            }
          }

          for (const actionItem of classification.actionItems) {
            // Use email subject as fallback if action item title is generic
            const isGenericTitle = actionItem.title === "Manual review required" || !actionItem.title;
            const taskTitle = isGenericTitle
              ? `Review: ${email.subject || "(No Subject)"}`
              : actionItem.title;
            const taskDescription = isGenericTitle
              ? `Email from ${email.from?.emailAddress?.name || "Unknown"} <${email.from?.emailAddress?.address || ""}>\n\n${classification.summary || "AI classification failed - please review this email manually."}`
              : `${actionItem.description || ""}\n\nFrom email: ${email.subject}\nSender: ${email.from?.emailAddress?.name} <${email.from?.emailAddress?.address}>`;

            // Store in email_action_items with account_id for proper cleanup
            await supabase.from("email_action_items").insert({
              email_message_id: email.id,
              account_id: connection.id,
              title: taskTitle,
              description: actionItem.description || classification.summary,
              action_type: actionItem.type,
              mentioned_date: actionItem.dueDate ? new Date(actionItem.dueDate) : null,
              priority: actionItem.priority,
              confidence: actionItem.confidence,
              status: "pending",
            });

            // Create task in main tasks table
            // action_type_id is optional - tasks work without it
            const taskPoolActionCode = ACTION_TYPE_MAP[actionItem.type] || "PROCESS";
            const taskPoolActionTypeId = actionTypeByCode[taskPoolActionCode] || null;

            const { data: newTask, error: taskError } = await supabase
              .from("tasks")
              .insert({
                title: taskTitle,
                description: taskDescription,
                action_type_id: taskPoolActionTypeId, // Optional - may be null
                client_id: matchedClientId,
                priority: actionItem.priority,
                due_date: actionItem.dueDate ? new Date(actionItem.dueDate).toISOString().split("T")[0] : null,
                source_type: "email",
                source_email_id: email.id,
                source_metadata: {
                  email_subject: email.subject,
                  sender_name: email.from?.emailAddress?.name,
                  sender_email: email.from?.emailAddress?.address,
                  received_at: email.receivedDateTime,
                  classification_summary: classification.summary,
                },
                ai_confidence: actionItem.confidence,
                ai_extracted_data: {
                  action_item: actionItem,
                  classification_category: classification.category,
                  extracted_entities: classification.extractedEntities,
                },
                status: "pending", // Standard status, not "open"
                organization_id: DEFAULT_ORGANIZATION_ID,
                created_by: user.id,
              })
              .select("id")
              .single();

            if (taskError) {
              logger.error("[Email Sync] Failed to create task:", taskError);
            } else if (newTask) {
              // Log activity for the new task
              try {
                await supabase.from("task_activity_log").insert({
                  task_id: newTask.id,
                  action: "created",
                  details: {
                    source: "email_sync",
                    email_id: email.id,
                    email_subject: email.subject,
                    confidence: actionItem.confidence,
                  },
                  performed_by: user.id,
                });
              } catch {
                // Activity log is optional, don't fail the task creation
              }
              totalTasksCreated++;
            }
          }

          totalProcessed++;
        } catch (error) {
          logger.error("Error processing email:", error, { emailId: email.id });
          totalFailed++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      processed: totalProcessed,
      failed: totalFailed,
      tasksCreated: totalTasksCreated,
    });
  } catch (error) {
    logger.error("Error in sync:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
