/**
 * Advanced AI Email Classification System
 *
 * Uses GPT-4 to provide intelligent email classification with:
 * - Multi-action item extraction
 * - Entity extraction (dates, amounts, document types, names)
 * - Priority scoring (0-100)
 * - Client matching suggestions
 * - Draft response generation
 * - Assignment recommendations
 */

import OpenAI from "openai";
import type {
  AIEmailClassification,
  EmailTaskCategory,
  EmailMessage,
  AIEmailTask,
} from "./types";

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// Types for AI classification results
export interface AIClassificationResult {
  // Basic classification
  category: EmailTaskCategory;
  subcategory?: string;
  isBusinessRelevant: boolean;

  // Priority scoring (0-100)
  priorityScore: number;
  priorityFactors: {
    urgencyKeywords: number;
    senderImportance: number;
    deadlineMentioned: number;
    clientMatch: number;
    responseRequired: number;
    amountMentioned: number;
  };

  // Sentiment and urgency
  sentiment: "positive" | "neutral" | "negative";
  urgency: "low" | "medium" | "high" | "urgent";
  requiresResponse: boolean;
  responseDeadline?: string;

  // AI Summary
  summary: string;
  keyPoints: string[];

  // Action items extracted from email
  actionItems: {
    id: string;
    title: string;
    description?: string;
    type: "response" | "document" | "calendar" | "task" | "call" | "review";
    priority: "low" | "medium" | "high" | "urgent";
    dueDate?: string;
    confidence: number;
  }[];

  // Primary action (most important)
  primaryAction?: string;

  // Extracted entities
  extractedEntities: {
    dates: { value: string; context: string }[];
    amounts: { value: number; context: string; currency?: string }[];
    documentTypes: string[];
    names: { name: string; role?: string }[];
    phoneNumbers: string[];
    companies: string[];
  };

  // Client matching suggestions
  clientMatchSuggestions: {
    searchTerms: string[];
    possibleMatch: boolean;
    matchReason?: string;
  };

  // Assignment suggestion
  suggestedAssignment?: {
    reason: string;
    suggestedColumn?: string;
    suggestedTags?: string[];
  };

  // Draft response
  draftResponse?: {
    subject?: string;
    body: string;
    tone: "formal" | "friendly" | "urgent";
  };

  // Metadata
  confidence: number;
  processingTimeMs?: number;
  tokensUsed?: number;
  modelUsed: string;
}

// The comprehensive prompt for email classification
const EMAIL_CLASSIFICATION_PROMPT = `You are an AI assistant for a CPA/accounting firm's email management system. Analyze the following email and provide a comprehensive JSON response.

BUSINESS CONTEXT:
- Industry: Tax & Accounting Services
- Services: Tax preparation, tax planning, bookkeeping, payroll, business consulting, IRS representation, audit support
- Common client communications: Document submissions (W-2, 1099, K-1), tax questions, payment inquiries, appointment scheduling

CLASSIFICATION CATEGORIES (choose the most appropriate):
- document_request: Client sending or requesting documents
- question: Client asking questions
- payment: Payment/billing related
- appointment: Scheduling/meeting requests
- tax_filing: Tax return/filing related
- compliance: Regulatory/compliance matters
- follow_up: Following up on previous communication
- information: FYI/informational
- urgent: Time-sensitive matters
- internal: Internal team communication
- spam: Marketing/spam (should rarely be business relevant)
- other: Doesn't fit other categories

IMPORTANT GUIDELINES:
1. Extract MULTIPLE action items if present - emails often contain several things that need to be done
2. Be specific with action items - "Review W-2" is better than "Review document"
3. Detect deadlines from phrases like "by Friday", "ASAP", "before April 15"
4. Extract monetary amounts mentioned (tax owed, payment amounts, etc.)
5. Identify document types mentioned (W-2, 1099, K-1, bank statements, etc.)
6. Look for names mentioned that might help match to clients
7. Calculate priority score based on urgency, deadlines, amounts, and client importance
8. Suggest a draft response if the email clearly needs a reply

PRIORITY SCORING (0-100):
- Base: 50
- Urgent keywords (+20): "urgent", "asap", "immediately", "emergency"
- Deadline mentioned (+15): specific dates or "by end of week"
- IRS/government related (+15): mentions IRS, audit, notice
- Payment/amount mentioned (+10): specific dollar amounts
- Client history match (+10): appears to be existing client
- Question mark present (+5): indicates needs response
- FYI/no action needed (-20): purely informational

Provide your analysis in this exact JSON structure:
{
  "category": "string (from CLASSIFICATION CATEGORIES)",
  "subcategory": "string or null",
  "isBusinessRelevant": boolean,
  "priorityScore": number (0-100),
  "priorityFactors": {
    "urgencyKeywords": number (0-20),
    "senderImportance": number (0-10),
    "deadlineMentioned": number (0-15),
    "clientMatch": number (0-10),
    "responseRequired": number (0-10),
    "amountMentioned": number (0-10)
  },
  "sentiment": "positive" | "neutral" | "negative",
  "urgency": "low" | "medium" | "high" | "urgent",
  "requiresResponse": boolean,
  "responseDeadline": "ISO date string or null",
  "summary": "2-3 sentence summary",
  "keyPoints": ["array of key points"],
  "actionItems": [
    {
      "title": "specific action title",
      "description": "brief description",
      "type": "response" | "document" | "calendar" | "task" | "call" | "review",
      "priority": "low" | "medium" | "high" | "urgent",
      "dueDate": "ISO date string or null",
      "confidence": number (0-1)
    }
  ],
  "primaryAction": "most important action or null",
  "extractedEntities": {
    "dates": [{ "value": "ISO date", "context": "why this date matters" }],
    "amounts": [{ "value": number, "context": "what this amount is for", "currency": "USD" }],
    "documentTypes": ["W-2", "1099", etc.],
    "names": [{ "name": "full name", "role": "client/spouse/business" }],
    "phoneNumbers": ["formatted phone numbers"],
    "companies": ["company names"]
  },
  "clientMatchSuggestions": {
    "searchTerms": ["terms to search client database"],
    "possibleMatch": boolean,
    "matchReason": "why this might be an existing client"
  },
  "suggestedAssignment": {
    "reason": "why this assignment makes sense",
    "suggestedColumn": "pending" | "in_progress" | "waiting" | null,
    "suggestedTags": ["relevant tags"]
  },
  "draftResponse": {
    "subject": "Re: original subject or null",
    "body": "professional email response",
    "tone": "formal" | "friendly" | "urgent"
  } or null,
  "confidence": number (0-1)
}

Return ONLY valid JSON, no additional text or markdown.`;

/**
 * Classify an email using GPT-4
 */
export async function classifyEmailWithAI(
  email: Partial<EmailMessage>
): Promise<AIClassificationResult> {
  const startTime = Date.now();
  const client = getOpenAIClient();

  // Build the email content for analysis
  const emailContent = `
FROM: ${email.from?.name || "Unknown"} <${email.from?.email || "unknown@example.com"}>
TO: ${email.to?.map((t) => `${t.name || ""} <${t.email}>`).join(", ") || "unknown"}
SUBJECT: ${email.subject || "(no subject)"}
DATE: ${email.receivedAt ? new Date(email.receivedAt).toISOString() : "unknown"}
HAS ATTACHMENTS: ${email.hasAttachments ? "Yes" : "No"}

BODY:
${email.body || email.bodyPreview || "(no content)"}
`.trim();

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2500,
      temperature: 0.3, // Lower temperature for more consistent classification
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: EMAIL_CLASSIFICATION_PROMPT,
        },
        {
          role: "user",
          content: `Analyze this email:\n\n${emailContent}`,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content) as AIClassificationResult;

    // Add metadata
    parsed.processingTimeMs = Date.now() - startTime;
    parsed.tokensUsed = response.usage?.total_tokens;
    parsed.modelUsed = "gpt-4o";

    // Generate unique IDs for action items
    parsed.actionItems = (parsed.actionItems || []).map((item, index) => ({
      ...item,
      id: `action-${Date.now()}-${index}`,
    }));

    // Ensure required fields have defaults
    return {
      category: parsed.category || "other",
      subcategory: parsed.subcategory,
      isBusinessRelevant: parsed.isBusinessRelevant ?? true,
      priorityScore: parsed.priorityScore ?? 50,
      priorityFactors: parsed.priorityFactors || {
        urgencyKeywords: 0,
        senderImportance: 0,
        deadlineMentioned: 0,
        clientMatch: 0,
        responseRequired: 0,
        amountMentioned: 0,
      },
      sentiment: parsed.sentiment || "neutral",
      urgency: parsed.urgency || "medium",
      requiresResponse: parsed.requiresResponse ?? true,
      responseDeadline: parsed.responseDeadline,
      summary: parsed.summary || "Email received",
      keyPoints: parsed.keyPoints || [],
      actionItems: parsed.actionItems || [],
      primaryAction: parsed.primaryAction,
      extractedEntities: parsed.extractedEntities || {
        dates: [],
        amounts: [],
        documentTypes: [],
        names: [],
        phoneNumbers: [],
        companies: [],
      },
      clientMatchSuggestions: parsed.clientMatchSuggestions || {
        searchTerms: [],
        possibleMatch: false,
      },
      suggestedAssignment: parsed.suggestedAssignment,
      draftResponse: parsed.draftResponse,
      confidence: parsed.confidence ?? 0.5,
      processingTimeMs: parsed.processingTimeMs,
      tokensUsed: parsed.tokensUsed,
      modelUsed: parsed.modelUsed,
    };
  } catch (error) {
    console.error("[AI Classifier] Error classifying email:", error);

    // Return a minimal classification on error
    return {
      category: "other",
      isBusinessRelevant: true,
      priorityScore: 50,
      priorityFactors: {
        urgencyKeywords: 0,
        senderImportance: 0,
        deadlineMentioned: 0,
        clientMatch: 0,
        responseRequired: 0,
        amountMentioned: 0,
      },
      sentiment: "neutral",
      urgency: "medium",
      requiresResponse: true,
      summary: "AI classification unavailable - please review this email manually.",
      keyPoints: ["Automatic classification was not available for this email"],
      actionItems: [
        {
          id: `action-${Date.now()}-0`,
          title: "Review email", // Generic but will be replaced with email subject in sync
          description: "This email needs manual review as AI classification was unavailable.",
          type: "review",
          priority: "medium",
          confidence: 0,
        },
      ],
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
      confidence: 0,
      processingTimeMs: Date.now() - startTime,
      modelUsed: "error",
    };
  }
}

/**
 * Convert AI classification result to the EmailMessage AIEmailClassification format
 */
export function convertToEmailClassification(
  result: AIClassificationResult
): AIEmailClassification {
  // Map action items to AIEmailTask format
  const actionTasks: AIEmailTask[] = result.actionItems.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    type: item.type === "response" ? "response" : item.type === "document" ? "document" : item.type === "calendar" ? "calendar" : item.type === "call" ? "action" : item.type === "review" ? "review" : "action",
    isCompleted: false,
    dueDate: item.dueDate ? new Date(item.dueDate) : undefined,
  }));

  // Map priority score to priority level
  const priority: "low" | "medium" | "high" | "urgent" =
    result.priorityScore >= 80
      ? "urgent"
      : result.priorityScore >= 60
      ? "high"
      : result.priorityScore >= 40
      ? "medium"
      : "low";

  // Determine suggested action
  let suggestedAction: AIEmailClassification["suggestedAction"] = "respond_today";
  if (result.urgency === "urgent") {
    suggestedAction = "respond_immediately";
  } else if (result.category === "document_request") {
    suggestedAction = "request_documents";
  } else if (result.category === "appointment") {
    suggestedAction = "schedule_call";
  } else if (!result.requiresResponse) {
    suggestedAction = "archive";
  } else if (result.category === "spam") {
    suggestedAction = "mark_as_spam";
  }

  return {
    category: result.category,
    priority,
    confidence: result.confidence,
    suggestedAction,
    summary: result.summary,
    keyPoints: result.keyPoints,
    sentiment: result.sentiment,
    topics: [result.category, result.subcategory].filter(Boolean) as string[],
    deadlineDetected: result.responseDeadline ? new Date(result.responseDeadline) : undefined,
    amountDetected: result.extractedEntities.amounts[0]?.value,
    requiresResponse: result.requiresResponse,
    responseUrgency: result.urgency === "urgent" ? "immediate" : result.urgency === "high" ? "today" : "this_week",
    classifiedAt: new Date(),
    actionTasks,
    primaryAction: result.primaryAction,
  };
}

/**
 * Check if AI classification is available
 */
export function isAIClassificationAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
