/**
 * AI Task Suggestion Engine
 *
 * Analyzes calls/emails and suggests tasks based on:
 * 1. AI analysis of content
 * 2. Learned patterns from user feedback
 * 3. Client/caller matching
 */

import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

// Types
export interface TaskSuggestion {
  title: string;
  description: string;
  actionTypeId?: string;
  clientId?: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate?: string;
  assignedTo?: string;
  reasoning: string;
  confidence: number;
  category: string;
  keywords: string[];
}

export interface CallContext {
  callId: string;
  callerPhone?: string;
  callerName?: string;
  transcript?: string;
  summary?: string;
  category?: string;
  sentiment?: string;
  urgency?: string;
  suggestedActions?: string[];
  keyPoints?: string[];
  duration?: number;
}

interface LearnedPattern {
  id: string;
  pattern_type: string;
  match_call_category?: string;
  match_keywords?: string[];
  match_client_id?: string;
  match_caller_phone?: string;
  suggest_assigned_to?: string;
  suggest_action_type_id?: string;
  suggest_priority?: string;
  confidence_score: number;
  acceptance_rate: number;
  times_matched?: number;
  last_matched_at?: string;
}

// Singleton OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const TASK_SUGGESTION_PROMPT = `You are an AI assistant for a CPA/accounting firm's task management system.
Analyze the following call information and suggest appropriate follow-up tasks.

For each suggested task, provide:
1. A clear, actionable title (start with a verb)
2. A brief description of what needs to be done
3. Priority level (low, medium, high, urgent)
4. Suggested due date relative to today (e.g., "tomorrow", "in 3 days", "next week")
5. Category that matches the task type
6. Keywords from the call that triggered this suggestion
7. Your reasoning for suggesting this task
8. Confidence level (0.0 to 1.0)

Common task categories for a CPA firm:
- tax_preparation: Preparing tax returns
- document_request: Request documents from client
- client_followup: Follow up with client on question/issue
- appointment_scheduling: Schedule a meeting
- review_required: Something needs manager/partner review
- payment_processing: Handle invoicing or payment
- data_entry: Enter information into system
- research: Research a tax/accounting question
- urgent_response: Time-sensitive matter requiring immediate attention

Return a JSON array of task suggestions. If no tasks are needed, return an empty array.

Example response format:
{
  "suggestions": [
    {
      "title": "Call client back regarding tax deadline question",
      "description": "Client asked about Q4 estimated tax payment deadline. Need to confirm dates and amounts.",
      "priority": "high",
      "dueDate": "tomorrow",
      "category": "client_followup",
      "keywords": ["estimated tax", "deadline", "Q4"],
      "reasoning": "Client expressed urgency about upcoming deadline and needs timely response",
      "confidence": 0.85
    }
  ]
}

Return ONLY valid JSON.`;

/**
 * Generate task suggestions from a completed call
 */
export async function generateTaskSuggestionsFromCall(
  context: CallContext
): Promise<TaskSuggestion[]> {
  const suggestions: TaskSuggestion[] = [];

  // 1. Check learned patterns first
  const patternSuggestions = await getPatternBasedSuggestions(context);
  suggestions.push(...patternSuggestions);

  // 2. Use AI to analyze call content for additional suggestions
  const aiSuggestions = await getAISuggestions(context);
  suggestions.push(...aiSuggestions);

  // 3. Try to match client by phone/name
  const clientMatch = await findMatchingClient(context);
  if (clientMatch) {
    suggestions.forEach((s) => {
      if (!s.clientId) {
        s.clientId = clientMatch.id;
      }
    });
  }

  // 4. Deduplicate similar suggestions
  return deduplicateSuggestions(suggestions);
}

/**
 * Get suggestions based on learned patterns
 */
async function getPatternBasedSuggestions(
  context: CallContext
): Promise<TaskSuggestion[]> {
  const supabase = await createClient();
  const suggestions: TaskSuggestion[] = [];

  // Find matching patterns
  const { data: patterns } = await supabase
    .from("task_ai_patterns")
    .select("*")
    .eq("is_active", true)
    .gte("confidence_score", 0.3);

  if (!patterns || patterns.length === 0) {
    return suggestions;
  }

  for (const pattern of patterns as LearnedPattern[]) {
    const matchScore = calculatePatternMatchScore(pattern, context);

    if (matchScore > 0.5) {
      // Pattern matches - create suggestion
      suggestions.push({
        title: generateTitleFromPattern(pattern, context),
        description: `Auto-suggested based on learned pattern (${Math.round(
          matchScore * 100
        )}% match)`,
        priority: (pattern.suggest_priority as TaskSuggestion["priority"]) || "medium",
        actionTypeId: pattern.suggest_action_type_id || undefined,
        assignedTo: pattern.suggest_assigned_to || undefined,
        reasoning: `Matched pattern: ${pattern.pattern_type} with ${Math.round(
          matchScore * 100
        )}% confidence`,
        confidence: matchScore * pattern.confidence_score,
        category: pattern.match_call_category || "general",
        keywords: pattern.match_keywords || [],
      });

      // Update pattern stats
      await supabase
        .from("task_ai_patterns")
        .update({
          times_matched: (pattern.times_matched || 0) + 1,
          last_matched_at: new Date().toISOString(),
        })
        .eq("id", pattern.id);
    }
  }

  return suggestions;
}

/**
 * Calculate how well a pattern matches the call context
 */
function calculatePatternMatchScore(
  pattern: LearnedPattern,
  context: CallContext
): number {
  let matchCount = 0;
  let totalCriteria = 0;

  // Check category match
  if (pattern.match_call_category) {
    totalCriteria++;
    if (
      context.category?.toLowerCase() ===
      pattern.match_call_category.toLowerCase()
    ) {
      matchCount++;
    }
  }

  // Check phone match
  if (pattern.match_caller_phone) {
    totalCriteria++;
    if (context.callerPhone?.includes(pattern.match_caller_phone)) {
      matchCount++;
    }
  }

  // Check keywords match
  if (pattern.match_keywords && pattern.match_keywords.length > 0) {
    totalCriteria++;
    const contextText = `${context.transcript || ""} ${
      context.summary || ""
    }`.toLowerCase();
    const keywordMatches = pattern.match_keywords.filter((kw) =>
      contextText.includes(kw.toLowerCase())
    );
    if (keywordMatches.length > 0) {
      matchCount += keywordMatches.length / pattern.match_keywords.length;
    }
  }

  if (totalCriteria === 0) return 0;
  return matchCount / totalCriteria;
}

/**
 * Generate a task title based on pattern and context
 */
function generateTitleFromPattern(
  pattern: LearnedPattern,
  context: CallContext
): string {
  const category = pattern.match_call_category || context.category || "inquiry";
  const caller = context.callerName || context.callerPhone || "caller";

  const titleTemplates: Record<string, string> = {
    tax_question: `Follow up with ${caller} on tax question`,
    document_request: `Request documents from ${caller}`,
    appointment_scheduling: `Schedule appointment with ${caller}`,
    payment_inquiry: `Process payment inquiry from ${caller}`,
    new_client_inquiry: `Follow up with potential new client ${caller}`,
    urgent_matter: `URGENT: Respond to ${caller}`,
    status_check: `Provide status update to ${caller}`,
    general_inquiry: `Follow up on call with ${caller}`,
  };

  return (
    titleTemplates[category] ||
    `Follow up on ${category} from ${caller}`
  );
}

/**
 * Get AI-generated task suggestions
 */
async function getAISuggestions(context: CallContext): Promise<TaskSuggestion[]> {
  const client = getOpenAIClient();
  if (!client) {
    console.log("[Task Suggestion] OpenAI not configured, skipping AI suggestions");
    return [];
  }

  // Don't suggest if no meaningful content
  if (!context.transcript && !context.summary && !context.suggestedActions?.length) {
    return [];
  }

  try {
    const callInfo = `
Call Information:
- Caller: ${context.callerName || context.callerPhone || "Unknown"}
- Duration: ${context.duration ? `${Math.round(context.duration / 60)} minutes` : "Unknown"}
- Category: ${context.category || "Unknown"}
- Sentiment: ${context.sentiment || "Unknown"}
- Urgency: ${context.urgency || "medium"}

Summary: ${context.summary || "No summary available"}

${context.keyPoints?.length ? `Key Points:\n${context.keyPoints.map((p) => `- ${p}`).join("\n")}` : ""}

${context.suggestedActions?.length ? `Previously Suggested Actions:\n${context.suggestedActions.map((a) => `- ${a}`).join("\n")}` : ""}

${context.transcript ? `Transcript excerpt (first 2000 chars):\n${context.transcript.substring(0, 2000)}` : ""}
    `.trim();

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: TASK_SUGGESTION_PROMPT },
        { role: "user", content: callInfo },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return [];

    const parsed = JSON.parse(content);
    const aiSuggestions = parsed.suggestions || [];

    return aiSuggestions.map((s: Record<string, unknown>) => ({
      title: s.title as string,
      description: s.description as string,
      priority: (s.priority as TaskSuggestion["priority"]) || "medium",
      dueDate: calculateDueDate(s.dueDate as string),
      category: s.category as string,
      keywords: (s.keywords as string[]) || [],
      reasoning: s.reasoning as string,
      confidence: (s.confidence as number) || 0.5,
    }));
  } catch (error) {
    console.error("[Task Suggestion] AI suggestion error:", error);
    return [];
  }
}

/**
 * Calculate actual due date from relative date string
 */
function calculateDueDate(relativeDate?: string): string | undefined {
  if (!relativeDate) return undefined;

  const now = new Date();
  const lower = relativeDate.toLowerCase();

  if (lower.includes("today")) {
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("tomorrow")) {
    now.setDate(now.getDate() + 1);
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("week")) {
    now.setDate(now.getDate() + 7);
    return now.toISOString().split("T")[0];
  }
  if (lower.includes("3 day") || lower.includes("three day")) {
    now.setDate(now.getDate() + 3);
    return now.toISOString().split("T")[0];
  }

  // Try to extract days
  const daysMatch = lower.match(/(\d+)\s*day/);
  if (daysMatch) {
    now.setDate(now.getDate() + parseInt(daysMatch[1]));
    return now.toISOString().split("T")[0];
  }

  return undefined;
}

/**
 * Find matching client by phone or name
 */
async function findMatchingClient(
  context: CallContext
): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();

  // Try phone match first
  if (context.callerPhone) {
    const cleanPhone = context.callerPhone.replace(/\D/g, "");
    const { data: phoneMatch } = await supabase
      .from("clients")
      .select("id, first_name, last_name")
      .or(`phone.ilike.%${cleanPhone.slice(-10)}%,mobile.ilike.%${cleanPhone.slice(-10)}%`)
      .limit(1)
      .single();

    if (phoneMatch) {
      return {
        id: phoneMatch.id,
        name: `${phoneMatch.first_name} ${phoneMatch.last_name}`,
      };
    }
  }

  // Try name match
  if (context.callerName) {
    const nameParts = context.callerName.split(" ");
    if (nameParts.length >= 2) {
      const { data: nameMatch } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .ilike("first_name", `%${nameParts[0]}%`)
        .ilike("last_name", `%${nameParts[nameParts.length - 1]}%`)
        .limit(1)
        .single();

      if (nameMatch) {
        return {
          id: nameMatch.id,
          name: `${nameMatch.first_name} ${nameMatch.last_name}`,
        };
      }
    }
  }

  return null;
}

/**
 * Deduplicate similar suggestions
 */
function deduplicateSuggestions(
  suggestions: TaskSuggestion[]
): TaskSuggestion[] {
  const seen = new Map<string, TaskSuggestion>();

  for (const suggestion of suggestions) {
    // Create a key from title keywords
    const key = suggestion.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .split(" ")
      .filter((w) => w.length > 3)
      .sort()
      .join("-");

    const existing = seen.get(key);
    if (!existing || existing.confidence < suggestion.confidence) {
      seen.set(key, suggestion);
    }
  }

  return Array.from(seen.values());
}

/**
 * Store task suggestions in the database
 */
export async function storeTaskSuggestions(
  suggestions: TaskSuggestion[],
  sourceType: "phone_call" | "email" | "form",
  sourceId: string,
  sourceMetadata?: Record<string, unknown>
): Promise<string[]> {
  if (suggestions.length === 0) return [];

  const supabase = await createClient();
  const insertedIds: string[] = [];

  for (const suggestion of suggestions) {
    const { data, error } = await supabase
      .from("task_ai_suggestions")
      .insert({
        source_type: sourceType,
        source_id: sourceId,
        source_metadata: sourceMetadata || {},
        suggested_title: suggestion.title,
        suggested_description: suggestion.description,
        suggested_action_type_id: suggestion.actionTypeId,
        suggested_client_id: suggestion.clientId,
        suggested_priority: suggestion.priority,
        suggested_due_date: suggestion.dueDate,
        suggested_assigned_to: suggestion.assignedTo,
        ai_reasoning: suggestion.reasoning,
        ai_confidence: suggestion.confidence,
        ai_category: suggestion.category,
        ai_keywords: suggestion.keywords,
        status: "pending",
      })
      .select("id")
      .single();

    if (!error && data) {
      insertedIds.push(data.id);
    } else {
      console.error("[Task Suggestion] Failed to store suggestion:", error);
    }
  }

  return insertedIds;
}
