/**
 * AI Email Analyzer
 *
 * Analyzes forwarded emails to extract potential tasks using OpenAI.
 * Used by the shared inbox system to create potential task suggestions.
 */

import { openai } from '@/lib/ai/openai';
import logger from '@/lib/logger';
import { z } from 'zod';

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

export const EmailAnalysisSchema = z.object({
  from: z.string().email('Valid email address required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  receivedAt: z.date(),
});

export type EmailAnalysisInput = z.infer<typeof EmailAnalysisSchema>;

export const TaskSuggestionSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  priority: z.enum(['urgent', 'high', 'medium', 'low']),
  dueDate: z.string().nullable(), // ISO date string
  actionType: z.string().nullable(), // e.g., "tax_preparation", "client_meeting"
  confidence: z.number().min(0).max(100),
  reasoning: z.string(),
  extractedData: z.record(z.string(), z.unknown()).optional(),
});

export type TaskSuggestion = z.infer<typeof TaskSuggestionSchema>;

export interface AnalysisResult {
  success: boolean;
  suggestion?: TaskSuggestion;
  error?: string;
  shouldCreateTask: boolean; // If false, email doesn't require a task
  rawResponse?: string;
}

// ============================================================================
// AI EMAIL ANALYZER SERVICE
// ============================================================================

const ANALYSIS_PROMPT = `You are an AI assistant for Spencer McGaw CPA Hub, a business operating system for a CPA firm.

Your job is to analyze forwarded emails and determine if they require creating a task. If yes, extract the task details.

**Context:**
- This is a CPA firm handling tax preparation, client communications, document requests, meetings, etc.
- Not every email needs a task (e.g., newsletters, automated notifications, FYI emails don't need tasks)
- Focus on actionable items that require staff attention

**Output Format:**
Return a JSON object with:
{
  "shouldCreateTask": boolean,
  "title": "Brief task title (max 100 chars)",
  "description": "Detailed description of what needs to be done",
  "priority": "urgent" | "high" | "medium" | "low",
  "dueDate": "YYYY-MM-DD" or null,
  "actionType": "tax_preparation" | "client_meeting" | "document_request" | "follow_up" | "review" | null,
  "confidence": 0-100,
  "reasoning": "Why you made this decision",
  "extractedData": {
    // Any useful data extracted (client name, amounts, dates, etc.)
  }
}

**Priority Guidelines:**
- urgent: Client emergency, tax deadline today/tomorrow, legal issue
- high: Upcoming deadline (within week), important client matter
- medium: Regular client work, standard timelines
- low: General inquiries, informational items

**Examples:**

Email: "Hi, I need my 2024 tax return prepared. Filing is due April 15th."
Output: {
  "shouldCreateTask": true,
  "title": "Prepare 2024 tax return",
  "description": "Client requesting 2024 tax return preparation. Filing deadline is April 15th.",
  "priority": "high",
  "dueDate": "2024-04-10",
  "actionType": "tax_preparation",
  "confidence": 95,
  "reasoning": "Clear action item with deadline",
  "extractedData": { "year": "2024", "deadline": "2024-04-15" }
}

Email: "Thanks for the meeting yesterday. Looking forward to next steps."
Output: {
  "shouldCreateTask": false,
  "title": "",
  "description": "",
  "priority": "low",
  "dueDate": null,
  "actionType": null,
  "confidence": 90,
  "reasoning": "This is a thank you email with no actionable items",
  "extractedData": {}
}

Now analyze this email:`;

/**
 * Analyze an email and extract potential task information
 */
export async function analyzeEmailForTask(
  input: EmailAnalysisInput
): Promise<AnalysisResult> {
  try {
    // Validate input
    const validated = EmailAnalysisSchema.parse(input);

    // Prepare email content for analysis
    const emailContent = `
From: ${validated.from}
Subject: ${validated.subject}
Received: ${validated.receivedAt.toISOString()}

Body:
${validated.body}
    `.trim();

    logger.info('[AI Email Analyzer] Analyzing email', {
      from: validated.from,
      subject: validated.subject,
    });

    // Call OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: ANALYSIS_PROMPT,
        },
        {
          role: 'user',
          content: emailContent,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_tokens: 1000,
    });

    const duration = Date.now() - startTime;
    const rawResponse = completion.choices[0]?.message?.content;

    if (!rawResponse) {
      throw new Error('No response from OpenAI');
    }

    // Parse AI response
    const parsed = JSON.parse(rawResponse);

    // Validate the response structure
    const suggestion: TaskSuggestion = {
      title: parsed.title || 'Untitled Task',
      description: parsed.description || '',
      priority: parsed.priority || 'medium',
      dueDate: parsed.dueDate || null,
      actionType: parsed.actionType || null,
      confidence: parsed.confidence || 50,
      reasoning: parsed.reasoning || '',
      extractedData: parsed.extractedData || {},
    };

    logger.info('[AI Email Analyzer] Analysis complete', {
      from: validated.from,
      shouldCreateTask: parsed.shouldCreateTask,
      confidence: suggestion.confidence,
      duration,
      tokensUsed: completion.usage?.total_tokens,
    });

    return {
      success: true,
      shouldCreateTask: parsed.shouldCreateTask === true,
      suggestion,
      rawResponse,
    };
  } catch (error) {
    logger.error('[AI Email Analyzer] Analysis failed', { error });

    if (error instanceof z.ZodError) {
      return {
        success: false,
        shouldCreateTask: false,
        error: `Validation error: ${error.issues.map((e) => e.message).join(', ')}`,
      };
    }

    return {
      success: false,
      shouldCreateTask: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch analyze multiple emails
 */
export async function analyzeEmailBatch(
  emails: EmailAnalysisInput[]
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  // Process sequentially to avoid rate limits
  for (const email of emails) {
    const result = await analyzeEmailForTask(email);
    results.push(result);

    // Small delay between requests to avoid rate limits
    if (emails.indexOf(email) < emails.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return results;
}
