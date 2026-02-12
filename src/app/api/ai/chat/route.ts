/**
 * AI Chat API
 * POST /api/ai/chat
 *
 * Handles conversational AI interactions with feed posts.
 * Can perform actions like creating tasks, assigning, replying, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import logger from '@/lib/logger';
import { Anthropic } from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, context } = body;

    if (!message || !context?.post) {
      return NextResponse.json({ error: 'Message and context required' }, { status: 400 });
    }

    const post = context.post;
    const conversationHistory = context.conversationHistory || [];

    // Build system prompt with context
    const systemPrompt = `You are an AI assistant helping manage business communications.

CURRENT CONTEXT:
- Communication Type: ${post.type}
- From: ${post.from} (${post.fromIdentifier})
- Subject: ${post.subject}
- Preview: ${post.preview || 'N/A'}
- AI Summary: ${post.aiSummary || 'N/A'}
- Sentiment: ${post.sentiment || 'N/A'}
- Intent: ${post.intent || 'N/A'}
${post.transcription ? `- Transcription: ${post.transcription.substring(0, 500)}...` : ''}

USER CAPABILITIES:
You can help the user take actions by responding with natural language. When the user asks you to do something, acknowledge it conversationally.

AVAILABLE ACTIONS:
- Create a task
- Assign to someone
- Send a reply email/sms
- Schedule a meeting
- Mark as done
- Create a note

When user requests an action, respond naturally and indicate what you would do. For example:
- "I'll create a task for this" → Respond with details about the task
- "Assign to Sarah" → Respond acknowledging assignment
- "Send them a reply" → Respond with draft reply

Your responses should be:
- Conversational and helpful
- Concise (2-3 sentences usually)
- Action-oriented when appropriate
- Proactive with suggestions

If user asks general questions about the communication, answer based on the context provided.`;

    // Build conversation for Claude
    const messages = [
      ...conversationHistory.slice(-10).map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })),
      {
        role: 'user',
        content: message,
      },
    ];

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages as any,
    });

    const aiMessage = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse AI response for actions
    const actions = detectActions(aiMessage, message.toLowerCase());

    // Execute detected actions
    const executedActions = await executeActions(actions, post, user.id, supabase);

    const duration = Date.now() - startTime;

    logger.info('[AI Chat] Response generated', {
      userId: user.id,
      postType: post.type,
      actionsDetected: actions.length,
      actionsExecuted: executedActions.length,
      duration,
    });

    return NextResponse.json({
      message: aiMessage,
      actions: executedActions,
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('[AI Chat] Failed to generate response', {
      error,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Failed to generate AI response',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Detect actions from AI response and user message
 */
function detectActions(aiResponse: string, userMessage: string): {
  type: string;
  params: any;
}[] {
  const actions: { type: string; params: any }[] = [];
  const lower = userMessage;

  // Create task
  if (
    lower.includes('create task') ||
    lower.includes('make a task') ||
    lower.includes('add a task') ||
    lower.includes('create a task')
  ) {
    actions.push({
      type: 'create_task',
      params: {},
    });
  }

  // Assign
  if (lower.includes('assign to') || lower.includes('assign this')) {
    const assignToMatch = lower.match(/assign (?:to |this to )?(\w+)/);
    actions.push({
      type: 'assign',
      params: {
        assigneeName: assignToMatch?.[1],
      },
    });
  }

  // Send reply
  if (
    lower.includes('send a reply') ||
    lower.includes('reply to') ||
    lower.includes('send them') ||
    lower.includes('email them')
  ) {
    actions.push({
      type: 'send_reply',
      params: {},
    });
  }

  // Mark done
  if (
    lower.includes('mark as done') ||
    lower.includes('mark done') ||
    lower.includes('complete this') ||
    lower.includes('mark handled')
  ) {
    actions.push({
      type: 'mark_done',
      params: {},
    });
  }

  // Schedule meeting
  if (
    lower.includes('schedule meeting') ||
    lower.includes('book a meeting') ||
    lower.includes('set up a meeting')
  ) {
    actions.push({
      type: 'schedule_meeting',
      params: {},
    });
  }

  return actions;
}

/**
 * Execute detected actions
 */
async function executeActions(
  actions: { type: string; params: any }[],
  post: any,
  userId: string,
  supabase: any
): Promise<{ type: string; description: string }[]> {
  const executed: { type: string; description: string }[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_task':
          // Create task from post
          const taskResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: post.subject,
              description: post.preview || post.aiSummary || '',
              priority: post.priority === 'urgent' ? 'urgent' : 'medium',
              status: 'open',
              source_type: post.type,
              source_email_id: post.type === 'email' ? post.id : null,
            }),
          });

          if (taskResponse.ok) {
            executed.push({
              type: 'task_created',
              description: `✅ Created task: "${post.subject.substring(0, 50)}..."`,
            });
          }
          break;

        case 'assign':
          // Find user by name
          if (action.params.assigneeName) {
            const { data: users } = await supabase
              .from('user_profiles')
              .select('id, full_name')
              .ilike('full_name', `%${action.params.assigneeName}%`)
              .limit(1);

            if (users && users.length > 0) {
              executed.push({
                type: 'assigned',
                description: `✅ Would assign to ${users[0].full_name}`,
              });
            }
          }
          break;

        case 'send_reply':
          executed.push({
            type: 'email_sent',
            description: `✅ Would send reply to ${post.from}`,
          });
          break;

        case 'mark_done':
          // Update the post as handled
          if (post.type === 'email') {
            await supabase
              .from('email_messages')
              .update({ is_read: true })
              .eq('id', post.id);
          }

          executed.push({
            type: 'marked_done',
            description: `✅ Marked as handled`,
          });
          break;

        case 'schedule_meeting':
          executed.push({
            type: 'meeting_scheduled',
            description: `✅ Would schedule meeting (feature coming soon)`,
          });
          break;
      }
    } catch (error) {
      logger.error('[AI Chat] Action execution failed', {
        action: action.type,
        error,
      });
    }
  }

  return executed;
}
