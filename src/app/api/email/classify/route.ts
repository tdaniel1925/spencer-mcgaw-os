/**
 * Email Classification API
 *
 * Comprehensive email classification endpoint that:
 * 1. Runs AI classification with GPT-4
 * 2. Matches sender to clients
 * 3. Applies assignment rules
 * 4. Extracts action items
 * 5. Returns complete classification result
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  classifyEmailWithAI,
  convertToEmailClassification,
  isAIClassificationAvailable,
  type AIClassificationResult,
} from "@/lib/email/ai-classifier";
import {
  matchEmailToClient,
  saveClientMatch,
} from "@/lib/email/client-matcher";
import {
  determineAssignment,
  recordUserAction,
} from "@/lib/email/assignment-engine";
import { classifyEmail } from "@/lib/email/email-classifier";
import type { EmailMessage } from "@/lib/email/types";
import { db } from "@/db";
import { tasks } from "@/db/schema";
import logger from "@/lib/logger";

// Classification response type
interface ClassificationResponse {
  success: boolean;
  classification: {
    // Basic
    category: string;
    subcategory?: string;
    isBusinessRelevant: boolean;

    // Priority
    priorityScore: number;
    priorityLevel: "low" | "medium" | "high" | "urgent";
    priorityFactors?: Record<string, number>;

    // Sentiment/Urgency
    sentiment: string;
    urgency: string;
    requiresResponse: boolean;
    responseDeadline?: string;

    // Summary
    summary: string;
    keyPoints: string[];

    // Action items
    actionItems: {
      id: string;
      title: string;
      description?: string;
      type: string;
      priority: string;
      dueDate?: string;
      confidence: number;
    }[];
    primaryAction?: string;

    // Entities
    extractedEntities: {
      dates: { value: string; context: string }[];
      amounts: { value: number; context: string }[];
      documentTypes: string[];
      names: { name: string; role?: string }[];
    };

    // Client match
    clientMatch?: {
      clientId: string;
      clientName: string;
      matchType: string;
      confidence: number;
    };
    alternativeClients?: {
      clientId: string;
      clientName: string;
      confidence: number;
    }[];

    // Assignment
    assignment: {
      userId?: string;
      userName?: string;
      column: string;
      tags: string[];
      shouldCreateTask: boolean;
      reason: string;
    };

    // Draft response
    draftResponse?: {
      subject?: string;
      body: string;
      tone: string;
    };

    // Metadata
    confidence: number;
    processingTimeMs: number;
    aiUsed: boolean;
  };
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ClassificationResponse>> {
  const startTime = Date.now();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { success: false, classification: {} as any, error: "Not authenticated" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { email } = body as { email: Partial<EmailMessage> };

    if (!email || !email.from?.email) {
      return NextResponse.json(
        { success: false, classification: {} as any, error: "Email data required" },
        { status: 400 }
      );
    }

    let aiResult: AIClassificationResult | null = null;
    let useAI = isAIClassificationAvailable();

    // Step 1: AI Classification
    if (useAI) {
      try {
        aiResult = await classifyEmailWithAI(email);
      } catch (error) {
        logger.error("[Classify API] AI classification failed:", error);
        useAI = false;
      }
    }

    // Fallback to rule-based classification
    if (!aiResult) {
      const ruleBasedResult = classifyEmail(email);
      // Convert to AI result format
      aiResult = {
        category: ruleBasedResult.classification.category,
        isBusinessRelevant: ruleBasedResult.isBusinessRelevant,
        priorityScore: ruleBasedResult.classification.priority === "urgent" ? 90 :
                       ruleBasedResult.classification.priority === "high" ? 70 :
                       ruleBasedResult.classification.priority === "medium" ? 50 : 30,
        priorityFactors: {
          urgencyKeywords: 0,
          senderImportance: 0,
          deadlineMentioned: 0,
          clientMatch: 0,
          responseRequired: 0,
          amountMentioned: 0,
        },
        sentiment: ruleBasedResult.classification.sentiment,
        urgency: ruleBasedResult.classification.priority === "urgent" ? "urgent" :
                 ruleBasedResult.classification.priority === "high" ? "high" : "medium",
        requiresResponse: ruleBasedResult.classification.requiresResponse,
        summary: ruleBasedResult.classification.summary,
        keyPoints: ruleBasedResult.classification.keyPoints,
        actionItems: [],
        extractedEntities: {
          dates: [],
          amounts: [],
          documentTypes: [],
          names: [],
          phoneNumbers: [],
          companies: [],
        },
        clientMatchSuggestions: {
          searchTerms: [],
          possibleMatch: false,
        },
        confidence: ruleBasedResult.confidence,
        modelUsed: "rules",
      };
    }

    // Step 2: Client Matching
    const clientMatchResult = await matchEmailToClient(
      email.from.email,
      email.from.name,
      aiResult.extractedEntities.names.map((n) => n.name),
      aiResult.extractedEntities.phoneNumbers,
      aiResult.extractedEntities.companies
    );

    // Save client match
    if (email.messageId) {
      await saveClientMatch(
        email.messageId,
        email.from.email,
        clientMatchResult.primaryMatch || null,
        clientMatchResult.alternativeMatches.map((m) => m.clientId)
      );
    }

    // Get client's assigned user if matched
    let clientAssigneeId: string | undefined;
    if (clientMatchResult.primaryMatch) {
      const { data: client } = await supabase
        .from("clients")
        .select("assigned_user_id")
        .eq("id", clientMatchResult.primaryMatch.clientId)
        .single();
      clientAssigneeId = client?.assigned_user_id;
    }

    // Step 3: Assignment
    const assignmentResult = await determineAssignment({
      senderEmail: email.from.email,
      subject: email.subject || "",
      body: email.body || email.bodyPreview,
      classification: aiResult,
      hasAttachments: email.hasAttachments || false,
      clientMatched: !!clientMatchResult.primaryMatch,
      matchedClientAssigneeId: clientAssigneeId,
    });

    // Step 4: Save classification to database
    if (email.messageId) {
      await supabase.from("email_classifications").upsert({
        email_message_id: email.messageId,
        category: aiResult.category,
        subcategory: aiResult.subcategory,
        is_business_relevant: aiResult.isBusinessRelevant,
        priority_score: aiResult.priorityScore,
        priority_factors: aiResult.priorityFactors,
        sentiment: aiResult.sentiment,
        urgency: aiResult.urgency,
        requires_response: aiResult.requiresResponse,
        response_deadline: aiResult.responseDeadline,
        summary: aiResult.summary,
        key_points: aiResult.keyPoints,
        extracted_dates: aiResult.extractedEntities.dates.map((d) => d.value),
        extracted_amounts: aiResult.extractedEntities.amounts.map((a) => a.value),
        extracted_document_types: aiResult.extractedEntities.documentTypes,
        extracted_names: aiResult.extractedEntities.names.map((n) => n.name),
        suggested_assignee_id: assignmentResult.assignedUserId,
        suggested_column: assignmentResult.assignedColumn,
        assignment_reason: assignmentResult.assignmentReason,
        draft_response: aiResult.draftResponse?.body,
        draft_response_tone: aiResult.draftResponse?.tone,
        model_used: aiResult.modelUsed,
        confidence: aiResult.confidence,
        processing_time_ms: Date.now() - startTime,
        tokens_used: aiResult.tokensUsed,
      }, {
        onConflict: "email_message_id",
      });

      // Save action items
      if (aiResult.actionItems.length > 0) {
        const actionItemsToInsert = aiResult.actionItems.map((item) => ({
          email_message_id: email.messageId,
          title: item.title,
          description: item.description,
          action_type: item.type,
          mentioned_date: item.dueDate,
          status: "pending",
          priority: item.priority,
          confidence: item.confidence,
          extraction_method: aiResult?.modelUsed || "unknown",
          linked_client_id: clientMatchResult.primaryMatch?.clientId,
        }));

        await supabase.from("email_action_items").insert(actionItemsToInsert);

        // Auto-create tasks from action items
        for (const item of aiResult.actionItems) {
          try {
            await db.insert(tasks).values({
              title: item.title,
              description: item.description || `AI-extracted task from email: ${email.subject || "No subject"}`,
              status: "pending",
              priority: item.priority === "urgent" ? "urgent" :
                       item.priority === "high" ? "high" :
                       item.priority === "medium" ? "medium" : "low",
              source: "email",
              clientId: clientMatchResult.primaryMatch?.clientId,
              assignedToId: assignmentResult.assignedUserId,
              dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
              metadata: {
                aiSuggested: true,
                aiConfidence: item.confidence,
                aiSourceType: "email_extraction",
                emailMessageId: email.messageId,
                emailSubject: email.subject,
                senderEmail: email.from?.email,
                senderName: email.from?.name,
                actionType: item.type,
              },
            });
          } catch (taskError) {
            logger.error("[Email Classify] Failed to create task:", taskError, { title: item.title });
          }
        }
      }
    }

    // Build response
    const priorityLevel = aiResult.priorityScore >= 80 ? "urgent" :
                          aiResult.priorityScore >= 60 ? "high" :
                          aiResult.priorityScore >= 40 ? "medium" : "low";

    const response: ClassificationResponse = {
      success: true,
      classification: {
        category: aiResult.category,
        subcategory: aiResult.subcategory,
        isBusinessRelevant: aiResult.isBusinessRelevant,
        priorityScore: aiResult.priorityScore,
        priorityLevel,
        priorityFactors: aiResult.priorityFactors,
        sentiment: aiResult.sentiment,
        urgency: aiResult.urgency,
        requiresResponse: aiResult.requiresResponse,
        responseDeadline: aiResult.responseDeadline,
        summary: aiResult.summary,
        keyPoints: aiResult.keyPoints,
        actionItems: aiResult.actionItems,
        primaryAction: aiResult.primaryAction,
        extractedEntities: {
          dates: aiResult.extractedEntities.dates,
          amounts: aiResult.extractedEntities.amounts,
          documentTypes: aiResult.extractedEntities.documentTypes,
          names: aiResult.extractedEntities.names,
        },
        clientMatch: clientMatchResult.primaryMatch ? {
          clientId: clientMatchResult.primaryMatch.clientId,
          clientName: `${clientMatchResult.primaryMatch.firstName} ${clientMatchResult.primaryMatch.lastName}`,
          matchType: clientMatchResult.primaryMatch.matchType,
          confidence: clientMatchResult.primaryMatch.confidence,
        } : undefined,
        alternativeClients: clientMatchResult.alternativeMatches.map((m) => ({
          clientId: m.clientId,
          clientName: `${m.firstName} ${m.lastName}`,
          confidence: m.confidence,
        })),
        assignment: {
          userId: assignmentResult.assignedUserId,
          userName: assignmentResult.assignedUserName,
          column: assignmentResult.assignedColumn,
          tags: assignmentResult.tags,
          shouldCreateTask: assignmentResult.shouldCreateTask,
          reason: assignmentResult.assignmentReason,
        },
        draftResponse: aiResult.draftResponse,
        confidence: aiResult.confidence,
        processingTimeMs: Date.now() - startTime,
        aiUsed: useAI,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("[Classify API] Error:", error);
    return NextResponse.json(
      {
        success: false,
        classification: {} as any,
        error: error instanceof Error ? error.message : "Classification failed",
      },
      { status: 500 }
    );
  }
}

// Record user action for learning
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      emailMessageId,
      senderEmail,
      subject,
      category,
      priority,
      actionType,
      actionValue,
      previousColumn,
      newColumn,
      previousAssignee,
      newAssignee,
      timeToActionMs,
    } = body;

    await recordUserAction(
      user.id,
      emailMessageId,
      { senderEmail, subject, category, priority },
      {
        type: actionType,
        value: actionValue,
        previousColumn,
        newColumn,
        previousAssignee,
        newAssignee,
      },
      timeToActionMs
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[Classify API] Error recording action:", error);
    return NextResponse.json(
      { error: "Failed to record action" },
      { status: 500 }
    );
  }
}
