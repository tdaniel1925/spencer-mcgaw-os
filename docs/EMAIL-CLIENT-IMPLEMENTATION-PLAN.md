# 📧 Email Client Implementation Plan - Full Spike-like Experience

## 🎯 Goal
Build a complete email client that replaces Outlook/Gmail with:
- **Conversational threading** (like Spike)
- **Real-time sync** via Microsoft Graph webhooks
- **AI-powered intelligence** (categorization, tasks, priority)
- **Unified communications** (email + SMS + calls in one timeline)
- **Full integration** with calendar, files, clients, and tasks

---

## 📊 Current State Assessment

### ✅ What You Already Have

| Component | Status | Details |
|-----------|--------|---------|
| **Microsoft OAuth** | ✅ Complete | Full scopes: Mail.Read, Mail.ReadWrite, Mail.Send, Calendars |
| **Token Management** | ✅ Complete | AES-256-GCM encryption, auto-refresh, stored in email_connections |
| **AI Task Engine** | ✅ Complete | OpenAI GPT-4o, pattern learning, already supports email source |
| **Real-time Infrastructure** | ✅ Complete | Supabase real-time subscriptions |
| **Calendar Sync** | ✅ Complete | Microsoft Calendar already integrated |
| **SMS System** | ✅ Complete | Twilio, conversations, threading |
| **Client Matching** | ✅ Complete | Auto-match by email/phone |
| **File Storage** | ✅ Complete | Supabase Storage, quota management |

### 🛠️ What Needs to Be Built

1. Email database schema
2. Microsoft Graph webhook subscriptions
3. Email sync engine (real-time)
4. Conversational threading algorithm
5. Email API endpoints
6. AI categorization & priority scoring
7. Email-to-task generation (integrate existing AI)
8. Inbox UI (Spike-style)
9. Email composer
10. Unified timeline UI
11. Calendar meeting invite detection
12. File attachment integration

---

## 🏗️ Implementation Phases

### **Phase 1: Database & Sync Foundation** (Week 1)

#### 1.1 Database Schema

```typescript
// email_messages table
id: uuid (primary key)
user_id: uuid (references users.id)
connection_id: uuid (references email_connections.id)
thread_id: uuid (references email_threads.id)
message_id: varchar(500) (Microsoft's unique ID)
conversation_id: varchar(500) (Microsoft's conversation grouping)
internet_message_id: varchar(500) (RFC 2822 message ID for threading)

// Content
subject: text
from_email: varchar(255)
from_name: varchar(255)
to_recipients: jsonb (array of {email, name})
cc_recipients: jsonb
bcc_recipients: jsonb
body_preview: varchar(500) (first 500 chars)
body_html: text
body_text: text

// Metadata
received_at: timestamp
sent_at: timestamp
importance: enum('low', 'normal', 'high')
is_read: boolean
is_flagged: boolean
is_draft: boolean
has_attachments: boolean
attachment_count: integer

// Organization
category: varchar(50) (AI-generated: primary, work, promotional, etc.)
priority_score: decimal (AI-generated: 0-100)
labels: jsonb (array of strings)

// Actions
is_archived: boolean
is_deleted: boolean
deleted_at: timestamp
folder: varchar(100) (inbox, sent, drafts, archive)

// AI
ai_summary: text (AI-generated summary)
ai_suggested_actions: jsonb (array of action suggestions)
ai_detected_intent: varchar(100) (question, request, fyi, urgent)
ai_sentiment: varchar(50) (positive, neutral, negative, urgent)

// Relations
client_id: uuid (auto-matched or manually linked)
related_task_ids: jsonb (array of task IDs created from this email)

created_at: timestamp
updated_at: timestamp

// Indexes
- (user_id, received_at DESC) - fast inbox listing
- (thread_id, received_at ASC) - fast thread retrieval
- (message_id) - deduplication
- (user_id, is_read) - unread count
- (user_id, category) - category filtering
- (client_id) - client communications
```

```typescript
// email_threads table
id: uuid (primary key)
user_id: uuid
subject: text (cleaned subject without Re:/Fwd:)
participants: jsonb (array of unique email addresses in thread)
participant_names: jsonb (array of names)

// Stats
message_count: integer
unread_count: integer
has_attachments: boolean

// Timestamps
first_message_at: timestamp
last_message_at: timestamp
last_activity_at: timestamp (last read/archive/etc.)

// Organization
category: varchar(50) (inherited from messages)
priority_score: decimal (max priority of all messages)
is_archived: boolean
is_muted: boolean
labels: jsonb

// Relations
client_id: uuid (if all messages in thread are with same client)

created_at: timestamp
updated_at: timestamp

// Indexes
- (user_id, last_message_at DESC) - inbox order
- (user_id, is_archived, last_message_at DESC) - active threads
```

```typescript
// email_attachments table
id: uuid (primary key)
message_id: uuid (references email_messages.id)
user_id: uuid

// Microsoft metadata
attachment_id: varchar(255) (Microsoft's ID)
name: varchar(500)
content_type: varchar(100)
size_bytes: bigint
is_inline: boolean
content_id: varchar(255) (for inline images)

// Storage
storage_path: varchar(1000) (path in Supabase Storage)
storage_bucket: varchar(100) (default: 'email-attachments')
download_url: text (temporary download URL)
download_url_expires_at: timestamp

// File system integration
file_id: uuid (references files.id if saved to document system)

created_at: timestamp
```

```typescript
// email_sync_state table (tracks sync progress per connection)
id: uuid (primary key)
connection_id: uuid (references email_connections.id)
user_id: uuid

// Sync tracking
last_sync_at: timestamp
last_successful_sync_at: timestamp
next_sync_scheduled_at: timestamp
sync_status: enum('idle', 'syncing', 'error', 'paused')
sync_error: text
sync_error_count: integer

// Delta sync (for incremental updates)
delta_token: text (Microsoft's delta link for efficient sync)
sync_cursor: varchar(500) (last message ID processed)

// Webhook subscription
webhook_subscription_id: varchar(255) (Microsoft subscription ID)
webhook_expires_at: timestamp
webhook_status: enum('active', 'expired', 'failed', 'none')
webhook_notification_url: text

// Stats
total_messages_synced: integer
last_message_count: integer
sync_duration_ms: integer

created_at: timestamp
updated_at: timestamp
```

```typescript
// email_ai_insights table (cache AI analysis to avoid re-processing)
id: uuid (primary key)
message_id: uuid (references email_messages.id)
user_id: uuid

// AI results
category: varchar(50)
priority_score: decimal
summary: text
detected_intent: varchar(100)
sentiment: varchar(50)
suggested_actions: jsonb
keywords: jsonb (array of important keywords)
entities: jsonb (names, companies, dates extracted)

// Task suggestions
suggested_tasks: jsonb (array of task suggestions)
task_confidence: decimal

// Client matching
suggested_client_id: uuid
client_match_confidence: decimal
client_match_reasoning: text

// Processing metadata
model_used: varchar(50) (e.g., 'gpt-4o')
processing_cost: decimal (estimated API cost)
processing_time_ms: integer
processed_at: timestamp

created_at: timestamp
```

#### 1.2 Microsoft Graph Webhook Setup

```typescript
// src/lib/email/webhook-manager.ts

/**
 * Microsoft Graph Subscription Manager
 *
 * Handles:
 * - Creating webhook subscriptions for real-time email notifications
 * - Renewing subscriptions (they expire every 3 days)
 * - Validating webhook signatures
 * - Processing change notifications
 */

export async function createEmailWebhookSubscription(
  userId: string,
  connectionId: string
): Promise<{ subscriptionId: string; expiresAt: Date }> {

  // 1. Get access token
  const token = await getAccessToken(connectionId);

  // 2. Create subscription via Microsoft Graph
  const subscription = await fetch(
    'https://graph.microsoft.com/v1.0/subscriptions',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        changeType: 'created,updated',
        notificationUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/email/webhook`,
        resource: 'me/messages',
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days
        clientState: generateSecureClientState(userId, connectionId), // For validation
      }),
    }
  );

  const data = await subscription.json();

  // 3. Store subscription details
  await updateSyncState(connectionId, {
    webhook_subscription_id: data.id,
    webhook_expires_at: data.expirationDateTime,
    webhook_status: 'active',
  });

  return {
    subscriptionId: data.id,
    expiresAt: new Date(data.expirationDateTime),
  };
}

/**
 * Cron job to renew subscriptions before they expire
 * Run every day
 */
export async function renewExpiringSubscriptions() {
  const supabase = await createClient();

  // Find subscriptions expiring in next 24 hours
  const { data: expiring } = await supabase
    .from('email_sync_state')
    .select('connection_id, user_id, webhook_subscription_id')
    .eq('webhook_status', 'active')
    .lt('webhook_expires_at', new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());

  for (const sub of expiring || []) {
    try {
      await renewWebhookSubscription(sub.connection_id, sub.webhook_subscription_id);
    } catch (error) {
      logger.error('Failed to renew webhook subscription', { connectionId: sub.connection_id, error });
    }
  }
}
```

#### 1.3 Email Sync Engine

```typescript
// src/lib/email/sync-service.ts

/**
 * Email Sync Service
 *
 * Two sync modes:
 * 1. Initial sync: Download all emails (paginated)
 * 2. Delta sync: Get only changes since last sync
 * 3. Webhook notifications: Process real-time updates
 */

export async function syncEmails(userId: string, connectionId: string): Promise<{
  messagesProcessed: number;
  newMessages: number;
  updatedMessages: number;
  errors: number;
}> {
  const supabase = await createClient();
  const stats = { messagesProcessed: 0, newMessages: 0, updatedMessages: 0, errors: 0 };

  try {
    // 1. Update sync status
    await updateSyncState(connectionId, {
      sync_status: 'syncing',
      last_sync_at: new Date().toISOString(),
    });

    // 2. Get connection and sync state
    const { data: syncState } = await supabase
      .from('email_sync_state')
      .select('delta_token, sync_cursor')
      .eq('connection_id', connectionId)
      .single();

    const token = await getAccessToken(connectionId);

    // 3. Determine sync type
    const useDelta = !!syncState?.delta_token;

    if (useDelta) {
      // Delta sync - only get changes
      const deltaUrl = `https://graph.microsoft.com/v1.0/me/messages/delta?${syncState.delta_token}`;
      await processDeltaSync(deltaUrl, token, userId, connectionId, stats);
    } else {
      // Initial sync - get all messages (paginated)
      const initialUrl = 'https://graph.microsoft.com/v1.0/me/messages?$top=100&$orderby=receivedDateTime desc';
      await processInitialSync(initialUrl, token, userId, connectionId, stats);
    }

    // 4. Update sync state - success
    await updateSyncState(connectionId, {
      sync_status: 'idle',
      last_successful_sync_at: new Date().toISOString(),
      sync_error: null,
      sync_error_count: 0,
      last_message_count: stats.newMessages,
    });

    return stats;

  } catch (error) {
    logger.error('[Email Sync] Sync failed', { userId, connectionId, error });

    // Update sync state - error
    await updateSyncState(connectionId, {
      sync_status: 'error',
      sync_error: error instanceof Error ? error.message : 'Unknown error',
      sync_error_count: (syncState?.sync_error_count || 0) + 1,
    });

    throw error;
  }
}

async function processInitialSync(
  url: string,
  token: string,
  userId: string,
  connectionId: string,
  stats: { messagesProcessed: number; newMessages: number; updatedMessages: number; errors: number }
) {
  let nextUrl: string | null = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await response.json();

    // Process batch of messages
    for (const message of data.value || []) {
      await processEmailMessage(message, userId, connectionId, stats);
    }

    // Get next page
    nextUrl = data['@odata.nextLink'] || null;

    // Save delta token when initial sync completes
    if (!nextUrl && data['@odata.deltaLink']) {
      await updateSyncState(connectionId, {
        delta_token: data['@odata.deltaLink'],
      });
    }
  }
}

async function processDeltaSync(
  deltaUrl: string,
  token: string,
  userId: string,
  connectionId: string,
  stats: { messagesProcessed: number; newMessages: number; updatedMessages: number; errors: number }
) {
  const response = await fetch(deltaUrl, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  const data = await response.json();

  // Process changed messages
  for (const message of data.value || []) {
    await processEmailMessage(message, userId, connectionId, stats);
  }

  // Update delta token for next sync
  if (data['@odata.deltaLink']) {
    await updateSyncState(connectionId, {
      delta_token: data['@odata.deltaLink'],
    });
  }
}

async function processEmailMessage(
  graphMessage: MicrosoftGraphMessage,
  userId: string,
  connectionId: string,
  stats: { messagesProcessed: number; newMessages: number; updatedMessages: number; errors: number }
) {
  try {
    const supabase = await createClient();

    // 1. Check if message already exists
    const { data: existing } = await supabase
      .from('email_messages')
      .select('id')
      .eq('message_id', graphMessage.id)
      .single();

    // 2. Find or create thread
    const threadId = await findOrCreateThread(userId, graphMessage);

    // 3. Try to match client
    const clientId = await matchEmailToClient(userId, graphMessage);

    // 4. Prepare message data
    const messageData = {
      user_id: userId,
      connection_id: connectionId,
      thread_id: threadId,
      message_id: graphMessage.id,
      conversation_id: graphMessage.conversationId,
      internet_message_id: graphMessage.internetMessageId,
      subject: graphMessage.subject,
      from_email: graphMessage.from?.emailAddress?.address,
      from_name: graphMessage.from?.emailAddress?.name,
      to_recipients: graphMessage.toRecipients?.map((r: any) => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name,
      })),
      cc_recipients: graphMessage.ccRecipients?.map((r: any) => ({
        email: r.emailAddress.address,
        name: r.emailAddress.name,
      })),
      body_preview: graphMessage.bodyPreview,
      body_html: graphMessage.body?.contentType === 'html' ? graphMessage.body.content : null,
      body_text: graphMessage.body?.contentType === 'text' ? graphMessage.body.content : null,
      received_at: graphMessage.receivedDateTime,
      sent_at: graphMessage.sentDateTime,
      importance: graphMessage.importance,
      is_read: graphMessage.isRead,
      is_flagged: graphMessage.flag?.flagStatus === 'flagged',
      is_draft: graphMessage.isDraft,
      has_attachments: graphMessage.hasAttachments,
      attachment_count: graphMessage.attachments?.length || 0,
      folder: determineFolder(graphMessage),
      client_id: clientId,
      updated_at: new Date().toISOString(),
    };

    if (existing) {
      // Update existing message
      await supabase
        .from('email_messages')
        .update(messageData)
        .eq('id', existing.id);
      stats.updatedMessages++;
    } else {
      // Insert new message
      const { data: newMessage } = await supabase
        .from('email_messages')
        .insert(messageData)
        .select('id')
        .single();

      stats.newMessages++;

      // Process attachments if any
      if (graphMessage.hasAttachments && newMessage) {
        await processAttachments(newMessage.id, graphMessage, connectionId);
      }

      // Queue for AI analysis
      await queueEmailForAI(newMessage.id, userId);

      // Real-time broadcast to user
      await broadcastNewEmail(userId, newMessage.id);
    }

    stats.messagesProcessed++;

  } catch (error) {
    logger.error('[Email Sync] Failed to process message', { messageId: graphMessage.id, error });
    stats.errors++;
  }
}
```

---

### **Phase 2: Threading & AI Intelligence** (Week 2)

#### 2.1 Conversational Threading (Spike-style)

```typescript
// src/lib/email/threading.ts

/**
 * Email Threading Algorithm
 *
 * Strategy:
 * 1. Use Microsoft's conversationId (simplest, most reliable)
 * 2. Fallback to internetMessageId + In-Reply-To headers
 * 3. Fallback to subject + participants matching
 */

export async function findOrCreateThread(
  userId: string,
  message: MicrosoftGraphMessage
): Promise<string> {
  const supabase = await createClient();

  // Strategy 1: Use Microsoft's conversationId (recommended)
  if (message.conversationId) {
    const { data: existingThread } = await supabase
      .from('email_threads')
      .select('id')
      .eq('user_id', userId)
      .eq('conversation_id', message.conversationId)
      .single();

    if (existingThread) {
      return existingThread.id;
    }
  }

  // Strategy 2: Check In-Reply-To header (RFC 2822)
  if (message.internetMessageHeaders) {
    const inReplyTo = message.internetMessageHeaders.find(
      (h: any) => h.name.toLowerCase() === 'in-reply-to'
    )?.value;

    if (inReplyTo) {
      const { data: replyThread } = await supabase
        .from('email_messages')
        .select('thread_id')
        .eq('internet_message_id', inReplyTo)
        .single();

      if (replyThread) {
        return replyThread.thread_id;
      }
    }
  }

  // Strategy 3: Subject + participants matching (fallback)
  const cleanSubject = cleanEmailSubject(message.subject);
  const participants = extractParticipants(message);

  const { data: subjectThread } = await supabase
    .from('email_threads')
    .select('id, participants')
    .eq('user_id', userId)
    .ilike('subject', cleanSubject)
    .limit(10);

  if (subjectThread) {
    // Find thread with overlapping participants
    for (const thread of subjectThread) {
      const overlap = calculateParticipantOverlap(thread.participants, participants);
      if (overlap > 0.7) { // 70% participant overlap
        return thread.id;
      }
    }
  }

  // No existing thread found - create new
  const { data: newThread } = await supabase
    .from('email_threads')
    .insert({
      user_id: userId,
      conversation_id: message.conversationId,
      subject: cleanSubject,
      participants: participants.emails,
      participant_names: participants.names,
      message_count: 1,
      unread_count: message.isRead ? 0 : 1,
      first_message_at: message.receivedDateTime,
      last_message_at: message.receivedDateTime,
    })
    .select('id')
    .single();

  return newThread.id;
}

function cleanEmailSubject(subject: string): string {
  // Remove Re:, Fwd:, Fw:, etc.
  return subject
    .replace(/^(Re|RE|Fwd|FW|Fw):\s*/gi, '')
    .trim()
    .toLowerCase();
}

function extractParticipants(message: MicrosoftGraphMessage): {
  emails: string[];
  names: string[];
} {
  const participants = new Set<string>();
  const names = new Map<string, string>();

  // Add from
  if (message.from?.emailAddress?.address) {
    participants.add(message.from.emailAddress.address.toLowerCase());
    names.set(message.from.emailAddress.address.toLowerCase(), message.from.emailAddress.name || '');
  }

  // Add to
  message.toRecipients?.forEach((r: any) => {
    participants.add(r.emailAddress.address.toLowerCase());
    names.set(r.emailAddress.address.toLowerCase(), r.emailAddress.name || '');
  });

  // Add cc
  message.ccRecipients?.forEach((r: any) => {
    participants.add(r.emailAddress.address.toLowerCase());
    names.set(r.emailAddress.address.toLowerCase(), r.emailAddress.name || '');
  });

  return {
    emails: Array.from(participants),
    names: Array.from(names.values()).filter(Boolean),
  };
}
```

#### 2.2 AI Categorization & Priority Scoring

```typescript
// src/lib/email/ai-categorization.ts

/**
 * AI Email Categorization
 *
 * Categories:
 * - primary: Important direct emails from people
 * - work: Work-related emails
 * - personal: Personal emails
 * - promotional: Marketing/promotional
 * - updates: Automated updates (receipts, notifications)
 * - forums: Mailing lists, forums
 * - social: Social network notifications
 * - spam: Likely spam
 */

export async function categorizeEmail(
  messageId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient();

  // 1. Get email message
  const { data: message } = await supabase
    .from('email_messages')
    .select('*')
    .eq('id', messageId)
    .single();

  if (!message) return;

  // 2. Call AI for categorization
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `Analyze this email and provide categorization:

From: ${message.from_email} (${message.from_name || 'Unknown'})
Subject: ${message.subject}
Preview: ${message.body_preview}

Provide:
1. Category (primary/work/personal/promotional/updates/forums/social/spam)
2. Priority score (0-100, higher = more important)
3. Brief summary (max 100 words)
4. Detected intent (question/request/fyi/urgent/meeting_invite)
5. Sentiment (positive/neutral/negative/urgent)
6. Suggested actions (array of strings)
7. Keywords (array of important keywords)
8. Client match (if from known client email)

Return JSON only.`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are an email categorization AI for a CPA firm. Be concise and accurate.',
      },
      { role: 'user', content: prompt },
    ],
  });

  const analysis = JSON.parse(response.choices[0].message.content || '{}');

  // 3. Store AI insights
  await supabase.from('email_ai_insights').insert({
    message_id: messageId,
    user_id: userId,
    category: analysis.category,
    priority_score: analysis.priority_score,
    summary: analysis.summary,
    detected_intent: analysis.detected_intent,
    sentiment: analysis.sentiment,
    suggested_actions: analysis.suggested_actions,
    keywords: analysis.keywords,
    model_used: 'gpt-4o',
    processed_at: new Date().toISOString(),
  });

  // 4. Update message with AI data
  await supabase
    .from('email_messages')
    .update({
      category: analysis.category,
      priority_score: analysis.priority_score,
      ai_summary: analysis.summary,
      ai_suggested_actions: analysis.suggested_actions,
      ai_detected_intent: analysis.detected_intent,
      ai_sentiment: analysis.sentiment,
    })
    .eq('id', messageId);
}
```

#### 2.3 AI Task Generation (Integrate Existing System)

```typescript
// src/lib/email/task-generation.ts

/**
 * Generate tasks from emails using existing task-suggestion-engine
 */

import { generateTaskSuggestionsFromEmail, storeTaskSuggestions } from '@/lib/ai/task-suggestion-engine';

export async function analyzeEmailForTasks(
  messageId: string,
  userId: string
): Promise<string[]> {
  const supabase = await createClient();

  // 1. Get email message
  const { data: message } = await supabase
    .from('email_messages')
    .select('*, ai_insights:email_ai_insights(*)')
    .eq('id', messageId)
    .single();

  if (!message) return [];

  // 2. Build context for task suggestion engine (similar to call context)
  const emailContext = {
    emailId: messageId,
    senderEmail: message.from_email,
    senderName: message.from_name,
    subject: message.subject,
    body: message.body_text || message.body_preview,
    summary: message.ai_summary,
    category: message.category,
    sentiment: message.ai_sentiment,
    intent: message.ai_detected_intent,
    suggestedActions: message.ai_suggested_actions,
    priority: message.priority_score > 70 ? 'high' : message.priority_score > 40 ? 'medium' : 'low',
  };

  // 3. Generate task suggestions using existing AI engine
  const suggestions = await generateTaskSuggestionsFromEmail(emailContext);

  // 4. Store suggestions in database
  const taskIds = await storeTaskSuggestions(
    suggestions,
    'email', // source_type
    messageId, // source_id
    { subject: message.subject, from: message.from_email } // metadata
  );

  // 5. Update email with task reference
  await supabase
    .from('email_messages')
    .update({
      related_task_ids: taskIds,
    })
    .eq('id', messageId);

  return taskIds;
}

/**
 * EXTEND existing task-suggestion-engine.ts to support email
 */

// Add to task-suggestion-engine.ts:

export interface EmailContext {
  emailId: string;
  senderEmail?: string;
  senderName?: string;
  subject?: string;
  body?: string;
  summary?: string;
  category?: string;
  sentiment?: string;
  intent?: string;
  suggestedActions?: string[];
  priority?: string;
}

export async function generateTaskSuggestionsFromEmail(
  context: EmailContext
): Promise<TaskSuggestion[]> {
  const suggestions: TaskSuggestion[] = [];

  // 1. Check learned patterns (adapt pattern matching for email)
  const patternSuggestions = await getEmailPatternBasedSuggestions(context);
  suggestions.push(...patternSuggestions);

  // 2. Use AI to analyze email content
  const aiSuggestions = await getAIEmailSuggestions(context);
  suggestions.push(...aiSuggestions);

  // 3. Try to match client by email
  const clientMatch = await findMatchingClientByEmail(context);
  if (clientMatch) {
    suggestions.forEach((s) => {
      if (!s.clientId) {
        s.clientId = clientMatch.id;
      }
    });
  }

  // 4. Deduplicate
  return deduplicateSuggestions(suggestions);
}

async function getAIEmailSuggestions(context: EmailContext): Promise<TaskSuggestion[]> {
  const client = getOpenAIClient();
  if (!client) return [];

  const emailInfo = `
Email Information:
- From: ${context.senderName || context.senderEmail || 'Unknown'}
- Subject: ${context.subject || 'No subject'}
- Category: ${context.category || 'Unknown'}
- Sentiment: ${context.sentiment || 'Unknown'}
- Intent: ${context.intent || 'Unknown'}
- Priority: ${context.priority || 'medium'}

Summary: ${context.summary || 'No summary'}

${context.suggestedActions?.length ? `Suggested Actions:\n${context.suggestedActions.map(a => `- ${a}`).join('\n')}` : ''}

${context.body ? `Email content (first 2000 chars):\n${context.body.substring(0, 2000)}` : ''}
  `.trim();

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 1500,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: TASK_SUGGESTION_PROMPT }, // Reuse existing prompt
      { role: 'user', content: emailInfo },
    ],
  });

  // Same parsing logic as calls
  // ...
}
```

---

### **Phase 3: API Endpoints & Composer** (Week 3)

#### 3.1 Email API Routes

```typescript
// src/app/api/email/messages/route.ts

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const folder = searchParams.get('folder') || 'inbox';
  const category = searchParams.get('category');
  const clientId = searchParams.get('client_id');
  const threadId = searchParams.get('thread_id');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  let query = supabase
    .from('email_messages')
    .select(`
      *,
      thread:email_threads!thread_id (
        id,
        subject,
        message_count,
        unread_count
      ),
      client:clients!client_id (
        id,
        first_name,
        last_name
      )
    `)
    .eq('user_id', user.id)
    .eq('folder', folder)
    .order('received_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (category) query = query.eq('category', category);
  if (clientId) query = query.eq('client_id', clientId);
  if (threadId) query = query.eq('thread_id', threadId);

  const { data: messages, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages, page, limit });
}

// src/app/api/email/send/route.ts

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { to, cc, bcc, subject, body, attachments, replyToMessageId } = await request.json();

  // 1. Get email connection
  const { data: connection } = await supabase
    .from('email_connections')
    .select('*')
    .eq('user_id', user.id)
    .eq('provider', 'microsoft')
    .eq('is_active', true)
    .single();

  if (!connection) {
    return NextResponse.json({ error: 'No email connection' }, { status: 400 });
  }

  const token = await getAccessToken(connection.id);

  // 2. Build message
  const message: any = {
    subject,
    body: {
      contentType: 'html',
      content: body,
    },
    toRecipients: to.map((email: string) => ({
      emailAddress: { address: email },
    })),
  };

  if (cc?.length) {
    message.ccRecipients = cc.map((email: string) => ({
      emailAddress: { address: email },
    }));
  }

  if (bcc?.length) {
    message.bccRecipients = bcc.map((email: string) => ({
      emailAddress: { address: email },
    }));
  }

  // Handle reply
  if (replyToMessageId) {
    const { data: originalMessage } = await supabase
      .from('email_messages')
      .select('message_id, internet_message_id')
      .eq('id', replyToMessageId)
      .single();

    if (originalMessage) {
      message.internetMessageHeaders = [
        { name: 'In-Reply-To', value: originalMessage.internet_message_id },
      ];
    }
  }

  // 3. Send via Microsoft Graph
  const sendResponse = await fetch(
    replyToMessageId
      ? `https://graph.microsoft.com/v1.0/me/messages/${originalMessage.message_id}/reply`
      : 'https://graph.microsoft.com/v1.0/me/sendMail',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(replyToMessageId ? { comment: body } : { message }),
    }
  );

  if (!sendResponse.ok) {
    const error = await sendResponse.json();
    return NextResponse.json({ error: error.error?.message || 'Send failed' }, { status: 500 });
  }

  // 4. Store sent message in database (will be synced back via webhook/sync)

  return NextResponse.json({ success: true });
}

// Additional routes:
// - PATCH /api/email/:id/read - Mark as read/unread
// - PATCH /api/email/:id/archive - Archive
// - PATCH /api/email/:id/flag - Flag
// - DELETE /api/email/:id - Delete
// - GET /api/email/search - Search
```

#### 3.2 Email Composer

```typescript
// src/components/email/email-composer.tsx

"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Send, Paperclip, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface EmailComposerProps {
  replyToMessageId?: string;
  replyToAddress?: string;
  onSent?: () => void;
}

export function EmailComposer({ replyToMessageId, replyToAddress, onSent }: EmailComposerProps) {
  const [to, setTo] = useState(replyToAddress || '');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    setSending(true);

    try {
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to.split(',').map(e => e.trim()),
          cc: cc ? cc.split(',').map(e => e.trim()) : [],
          subject,
          body,
          replyToMessageId,
          // attachments: TODO
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send');
      }

      // Clear form
      setTo('');
      setCc('');
      setSubject('');
      setBody('');
      setAttachments([]);

      onSent?.();
    } catch (error) {
      alert('Failed to send email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t bg-white p-4 space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="To:"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Cc:"
          value={cc}
          onChange={(e) => setCc(e.target.value)}
          className="flex-1"
        />
      </div>

      {!replyToMessageId && (
        <Input
          placeholder="Subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      )}

      <Textarea
        placeholder="Write your message..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={6}
        className="resize-none"
      />

      {attachments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {attachments.map((file, i) => (
            <div key={i} className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded text-sm">
              <span>{file.name}</span>
              <button onClick={() => setAttachments(prev => prev.filter((_, idx) => idx !== i))}>
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center">
        <Button variant="ghost" size="sm">
          <Paperclip className="h-4 w-4 mr-2" />
          Attach
        </Button>

        <Button onClick={handleSend} disabled={sending || !to || !body}>
          <Send className="h-4 w-4 mr-2" />
          {sending ? 'Sending...' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
```

---

### **Phase 4: UI & Integrations** (Week 4)

#### 4.1 Spike-Style Inbox UI

```typescript
// src/app/(dashboard)/email/page.tsx

"use client";

import { useState, useEffect } from 'react';
import { ThreadList } from '@/components/email/thread-list';
import { ConversationView } from '@/components/email/conversation-view';
import { EmailComposer } from '@/components/email/email-composer';
import { UnifiedTimeline } from '@/components/email/unified-timeline';

export default function EmailPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threads, setThreads] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unread, starred, primary

  useEffect(() => {
    loadThreads();
  }, [filter]);

  const loadThreads = async () => {
    const response = await fetch(`/api/email/threads?filter=${filter}`);
    const data = await response.json();
    setThreads(data.threads);
  };

  return (
    <div className="flex h-screen">
      {/* Left sidebar - Thread list */}
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="text-2xl font-bold">Inbox</h1>
          <div className="flex gap-2 mt-2">
            <button
              className={filter === 'all' ? 'font-bold' : ''}
              onClick={() => setFilter('all')}
            >
              All
            </button>
            <button
              className={filter === 'unread' ? 'font-bold' : ''}
              onClick={() => setFilter('unread')}
            >
              Unread
            </button>
            <button
              className={filter === 'primary' ? 'font-bold' : ''}
              onClick={() => setFilter('primary')}
            >
              Primary
            </button>
          </div>
        </div>

        <ThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={setSelectedThreadId}
        />
      </div>

      {/* Main area - Conversation */}
      <div className="flex-1 flex flex-col">
        {selectedThreadId ? (
          <>
            <ConversationView threadId={selectedThreadId} />
            <EmailComposer
              replyToMessageId={selectedThreadId}
              onSent={loadThreads}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            Select a conversation to read
          </div>
        )}
      </div>

      {/* Right sidebar - Context */}
      <div className="w-64 border-l p-4">
        {selectedThreadId && (
          <UnifiedTimeline threadId={selectedThreadId} />
        )}
      </div>
    </div>
  );
}
```

#### 4.2 Unified Communications Timeline

```typescript
// src/components/email/unified-timeline.tsx

/**
 * Shows unified view of all communications with a client:
 * - Emails
 * - SMS messages
 * - Phone calls
 * - Tasks
 * - Calendar events
 */

export function UnifiedTimeline({ threadId }: { threadId: string }) {
  const [timeline, setTimeline] = useState([]);

  useEffect(() => {
    loadTimeline();
  }, [threadId]);

  const loadTimeline = async () => {
    // Get thread to find client
    const threadResponse = await fetch(`/api/email/threads/${threadId}`);
    const thread = await threadResponse.json();

    if (!thread.client_id) {
      return; // No client linked
    }

    // Get all communications for this client
    const response = await fetch(`/api/clients/${thread.client_id}/timeline`);
    const data = await response.json();
    setTimeline(data.timeline);
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Communications</h3>

      {timeline.map((item) => (
        <div key={item.id} className="border-l-2 border-blue-500 pl-3 pb-3">
          <div className="text-xs text-gray-500">{formatDate(item.timestamp)}</div>
          <div className="font-medium">{item.type}</div>
          <div className="text-sm text-gray-600">{item.summary}</div>
        </div>
      ))}
    </div>
  );
}

// src/app/api/clients/[id]/timeline/route.ts

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const clientId = params.id;
  const timeline: any[] = [];

  // Get emails
  const { data: emails } = await supabase
    .from('email_messages')
    .select('id, subject, received_at, from_name')
    .eq('client_id', clientId)
    .order('received_at', { ascending: false })
    .limit(10);

  emails?.forEach((email) => {
    timeline.push({
      id: email.id,
      type: 'email',
      timestamp: email.received_at,
      summary: `Email: ${email.subject}`,
      from: email.from_name,
    });
  });

  // Get SMS
  const { data: sms } = await supabase
    .from('sms_messages')
    .select('id, body, sent_at, direction')
    .eq('client_id', clientId)
    .order('sent_at', { ascending: false })
    .limit(10);

  sms?.forEach((msg) => {
    timeline.push({
      id: msg.id,
      type: 'sms',
      timestamp: msg.sent_at,
      summary: `SMS ${msg.direction}: ${msg.body.substring(0, 50)}...`,
    });
  });

  // Get calls
  const { data: calls } = await supabase
    .from('calls')
    .select('id, caller_name, created_at, summary')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(10);

  calls?.forEach((call) => {
    timeline.push({
      id: call.id,
      type: 'call',
      timestamp: call.created_at,
      summary: `Call with ${call.caller_name}: ${call.summary?.substring(0, 50)}...`,
    });
  });

  // Get tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, created_at, status')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(10);

  tasks?.forEach((task) => {
    timeline.push({
      id: task.id,
      type: 'task',
      timestamp: task.created_at,
      summary: `Task: ${task.title} (${task.status})`,
    });
  });

  // Sort by timestamp
  timeline.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ timeline });
}
```

---

## 📅 Timeline Summary

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | Database & Sync | Schema, webhook subscriptions, sync engine |
| **Week 2** | Threading & AI | Conversation threading, categorization, task generation |
| **Week 3** | API & Composer | Send/reply endpoints, rich composer |
| **Week 4** | UI & Integration | Spike-style inbox, unified timeline, polish |

---

## 🚀 Quick Start

Once you approve, I'll begin with:

1. **Database schema** - Create all 5 tables
2. **Webhook manager** - Set up Microsoft Graph subscriptions
3. **Sync service** - Initial + delta sync
4. **Basic API** - List/read endpoints

Then iterate through threading, AI, and UI.

---

## ❓ Questions Before We Start

1. **Do you want me to start with Phase 1 now?**
2. **Any specific Spike features you want to prioritize or skip?**
3. **Should I create the database schema first and have you review before proceeding?**

Let me know and I'll start building! 🔥
