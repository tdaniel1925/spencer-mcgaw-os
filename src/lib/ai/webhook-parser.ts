/**
 * AI Webhook Parser
 *
 * This module uses OpenAI to intelligently parse any incoming webhook payload
 * and extract structured data for phone calls, web forms, or any other source.
 */

import OpenAI from "openai";

// Types for parsed webhook data
export type WebhookSource = "phone_call" | "web_form" | "email" | "sms" | "chat" | "unknown";

export interface ParsedContact {
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  company?: string;
}

export interface ParsedWebhookData {
  // Source identification
  source: WebhookSource;
  sourceProvider?: string; // e.g., "vapi", "twilio", "typeform", "custom"

  // Contact information
  contact: ParsedContact;

  // For phone calls
  call?: {
    direction?: "inbound" | "outbound";
    duration?: number; // seconds
    transcript?: string;
    summary?: string;
    recordingUrl?: string;
    startedAt?: string;
    endedAt?: string;
  };

  // For web forms
  form?: {
    formName?: string;
    submittedAt?: string;
    fields: Record<string, unknown>;
  };

  // AI Analysis
  analysis: {
    category: string;
    sentiment: "positive" | "neutral" | "negative" | "unknown";
    urgency: "low" | "medium" | "high" | "urgent";
    summary: string;
    keyPoints: string[];
    suggestedActions: string[];
    clientMatch?: {
      possibleMatch: boolean;
      searchTerms: string[];
    };
  };

  // Metadata
  rawPayload: Record<string, unknown>;
  parsedAt: string;
  confidence: number; // 0-1
}

// Singleton OpenAI client
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

const PARSING_PROMPT = `You are an AI assistant that parses webhook payloads for a CPA/accounting firm's office management system.

Your job is to analyze incoming JSON data from various sources (phone call transcripts, web form submissions, emails, etc.) and extract structured information.

IMPORTANT FOR VAPI PHONE CALLS:
- VAPI sends call data in various structures. Look for these key locations:
  - message.call, message.customer, message.artifact (nested structure)
  - call, customer, artifact (flat structure)
  - The artifact object often contains the transcript in artifact.transcript OR artifact.messages array
  - Customer phone number is usually in customer.number or customer.phoneNumber
  - Duration may be in call.duration (seconds) or calculate from startedAt/endedAt timestamps
- When you find a transcript, READ IT CAREFULLY and provide a meaningful summary of what was discussed
- The summary should explain: who called, what they wanted, what was discussed, and any action items

Given the raw JSON payload, extract and return a JSON object with this structure:

{
  "source": "phone_call" | "web_form" | "email" | "sms" | "chat" | "unknown",
  "sourceProvider": "string (e.g., vapi, twilio, typeform, jotform, custom)",
  "contact": {
    "name": "full name if available",
    "firstName": "first name",
    "lastName": "last name",
    "phone": "phone number in E.164 format if available",
    "email": "email address if available",
    "company": "company name if available"
  },
  "call": {
    "direction": "inbound" | "outbound" (only for phone calls),
    "duration": number in seconds,
    "transcript": "full transcript text (reconstruct from messages array if needed)",
    "summary": "brief summary of what was discussed in the call",
    "recordingUrl": "URL to recording if available",
    "startedAt": "ISO timestamp",
    "endedAt": "ISO timestamp"
  },
  "form": {
    "formName": "name of the form",
    "submittedAt": "ISO timestamp",
    "fields": { key-value pairs of form fields }
  },
  "analysis": {
    "category": "new_client_inquiry" | "existing_client_question" | "document_request" | "appointment_scheduling" | "payment_inquiry" | "tax_question" | "status_check" | "complaint" | "urgent_matter" | "follow_up" | "general_inquiry" | "spam" | "other",
    "sentiment": "positive" | "neutral" | "negative" | "unknown",
    "urgency": "low" | "medium" | "high" | "urgent",
    "summary": "2-3 sentence summary describing WHO called, WHAT they wanted, WHAT was discussed, and any ACTION ITEMS. Be specific and informative.",
    "keyPoints": ["array of key points or action items extracted from the conversation"],
    "suggestedActions": ["array of suggested follow-up actions based on the call content"],
    "clientMatch": {
      "possibleMatch": true/false (whether this might be an existing client),
      "searchTerms": ["terms to search for in client database"]
    }
  },
  "confidence": 0.0-1.0 (how confident you are in the parsing)
}

Important notes:
- READ THE FULL TRANSCRIPT and provide a MEANINGFUL summary - not just "a call was received"
- If there's a messages array (like artifact.messages), reconstruct the transcript from it
- Only include fields that have actual data (omit null/empty fields)
- For phone numbers, try to normalize to E.164 format (+1XXXXXXXXXX)
- For timestamps, convert to ISO 8601 format
- The "call" object should only be present for phone calls
- The "form" object should only be present for web form submissions
- Be generous with category classification - use context clues
- For accounting firms, common inquiries are about taxes, documents, deadlines, and appointments

Return ONLY valid JSON, no explanations or markdown.`;

/**
 * Parse any webhook payload using AI
 */
export async function parseWebhookWithAI(
  rawPayload: Record<string, unknown>
): Promise<ParsedWebhookData> {
  const client = getOpenAIClient();

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: PARSING_PROMPT,
        },
        {
          role: "user",
          content: `Here is the webhook payload to parse:\n\n${JSON.stringify(rawPayload, null, 2)}`,
        },
      ],
    });

    // Extract text from response
    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    const parsed = JSON.parse(content) as Partial<ParsedWebhookData>;

    // Ensure required fields have defaults
    const result: ParsedWebhookData = {
      source: parsed.source || "unknown",
      sourceProvider: parsed.sourceProvider,
      contact: parsed.contact || {},
      call: parsed.call,
      form: parsed.form,
      analysis: {
        category: parsed.analysis?.category || "other",
        sentiment: parsed.analysis?.sentiment || "unknown",
        urgency: parsed.analysis?.urgency || "medium",
        summary: parsed.analysis?.summary || "Unable to generate summary",
        keyPoints: parsed.analysis?.keyPoints || [],
        suggestedActions: parsed.analysis?.suggestedActions || [],
        clientMatch: parsed.analysis?.clientMatch,
      },
      rawPayload,
      parsedAt: new Date().toISOString(),
      confidence: parsed.confidence || 0.5,
    };

    return result;
  } catch (error) {
    console.error("[AI Parser] Error parsing webhook:", error);

    // Return a minimal parsed result on error
    return {
      source: "unknown",
      contact: {},
      analysis: {
        category: "other",
        sentiment: "unknown",
        urgency: "medium",
        summary: "Failed to parse webhook payload",
        keyPoints: [],
        suggestedActions: ["Manual review required"],
      },
      rawPayload,
      parsedAt: new Date().toISOString(),
      confidence: 0,
    };
  }
}

/**
 * Quick source detection without full AI parsing
 * Useful for routing or initial categorization
 */
export function detectSourceType(payload: Record<string, unknown>): WebhookSource {
  const payloadStr = JSON.stringify(payload).toLowerCase();

  // Phone call indicators
  if (
    payloadStr.includes("transcript") ||
    payloadStr.includes("recording") ||
    payloadStr.includes("call_sid") ||
    payloadStr.includes("callid") ||
    payloadStr.includes("duration") && payloadStr.includes("phone")
  ) {
    return "phone_call";
  }

  // Web form indicators
  if (
    payloadStr.includes("form_id") ||
    payloadStr.includes("formid") ||
    payloadStr.includes("submission") ||
    payloadStr.includes("typeform") ||
    payloadStr.includes("jotform") ||
    payloadStr.includes("webform")
  ) {
    return "web_form";
  }

  // Email indicators
  if (
    payloadStr.includes("subject") &&
    payloadStr.includes("body") &&
    (payloadStr.includes("from") || payloadStr.includes("sender"))
  ) {
    return "email";
  }

  // SMS indicators
  if (
    payloadStr.includes("sms") ||
    payloadStr.includes("messagingsid") ||
    (payloadStr.includes("body") && payloadStr.includes("from") && !payloadStr.includes("subject"))
  ) {
    return "sms";
  }

  return "unknown";
}

/**
 * Check if AI parsing is available (API key configured)
 */
export function isAIParsingAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY;
}
