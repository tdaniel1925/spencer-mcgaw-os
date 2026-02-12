/**
 * Communications Feed API
 * GET /api/feed
 *
 * Returns unified feed of all communications (emails, calls, SMS, chat)
 * sorted by timestamp, enriched with AI insights.
 *
 * Query params:
 * - limit: number of items (default: 50)
 * - offset: pagination offset (default: 0)
 * - filter: 'all' | 'email' | 'call' | 'sms' | 'chat' | 'unhandled' | 'urgent'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { calls, emailMessages } from '@/db/schema';
import { desc, and, eq, not, or, isNull, sql } from 'drizzle-orm';
import logger from '@/lib/logger';

export interface FeedPost {
  id: string;
  type: 'email' | 'call' | 'sms' | 'chat';
  timestamp: string;

  // Content
  from: string;
  fromIdentifier: string; // email or phone
  subject: string;
  preview: string | null;
  fullContent?: string;

  // AI-generated
  aiSummary?: string | null;
  aiSuggestedActions?: string[] | null;
  sentiment?: string | null;
  intent?: string | null;

  // Status
  isRead: boolean;
  isHandled: boolean;
  isFlagged: boolean;
  priority: 'urgent' | 'high' | 'normal' | 'low';

  // Relations
  userId?: string | null;
  clientId?: string | null;
  relatedTaskIds?: string[];

  // Type-specific
  duration?: number; // calls
  direction?: string; // calls
  recordingUrl?: string; // calls
  transcription?: string; // calls
  bodyHtml?: string; // emails
  bodyText?: string; // emails
  hasAttachments?: boolean; // emails
  attachmentCount?: number; // emails
}

export async function GET(request: NextRequest) {
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

    // Get query params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const filter = searchParams.get('filter') || 'all';

    // Fetch calls
    let callsData: any[] = [];
    if (filter === 'all' || filter === 'call' || filter === 'urgent') {
      const callsQuery = db
        .select({
          id: calls.id,
          vapiCallId: calls.vapiCallId,
          clientId: calls.clientId,
          callerPhone: calls.callerPhone,
          callerName: calls.callerName,
          status: calls.status,
          direction: calls.direction,
          duration: calls.duration,
          transcription: calls.transcription,
          summary: calls.summary,
          intent: calls.intent,
          sentiment: calls.sentiment,
          wasTransferred: calls.wasTransferred,
          recordingUrl: calls.recordingUrl,
          metadata: calls.metadata,
          createdAt: calls.createdAt,
        })
        .from(calls)
        .orderBy(desc(calls.createdAt))
        .limit(limit);

      callsData = await callsQuery;

      // Filter out voicemail/spam/wrong numbers
      const EXCLUDED_CATEGORIES = ['voicemail', 'wrong_number', 'spam'];
      callsData = callsData.filter((call) => {
        const category = (call.metadata as any)?.category;
        return !EXCLUDED_CATEGORIES.includes(category);
      });
    }

    // Fetch emails
    let emailsData: any[] = [];
    if (filter === 'all' || filter === 'email' || filter === 'unhandled' || filter === 'urgent') {
      // Build filters
      let whereConditions: any[] = [
        not(eq(emailMessages.isDeleted, true)),
        not(eq(emailMessages.isArchived, true)),
      ];

      // Ownership: user's emails + unassigned
      whereConditions.push(
        or(eq(emailMessages.userId, user.id), isNull(emailMessages.userId))
      );

      // Unhandled filter
      if (filter === 'unhandled') {
        whereConditions.push(eq(emailMessages.isRead, false));
      }

      // Urgent filter
      if (filter === 'urgent') {
        whereConditions.push(eq(emailMessages.importance, 'high'));
      }

      emailsData = await db
        .select({
          id: emailMessages.id,
          userId: emailMessages.userId,
          connectionId: emailMessages.connectionId,
          threadId: emailMessages.threadId,
          messageId: emailMessages.messageId,
          subject: emailMessages.subject,
          fromEmail: emailMessages.fromEmail,
          fromName: emailMessages.fromName,
          toRecipients: emailMessages.toRecipients,
          bodyPreview: emailMessages.bodyPreview,
          bodyHtml: emailMessages.bodyHtml,
          bodyText: emailMessages.bodyText,
          receivedAt: emailMessages.receivedAt,
          sentAt: emailMessages.sentAt,
          importance: emailMessages.importance,
          isRead: emailMessages.isRead,
          isFlagged: emailMessages.isFlagged,
          hasAttachments: emailMessages.hasAttachments,
          attachmentCount: emailMessages.attachmentCount,
          category: emailMessages.category,
          priorityScore: emailMessages.priorityScore,
          aiSummary: emailMessages.aiSummary,
          aiSuggestedActions: emailMessages.aiSuggestedActions,
          aiDetectedIntent: emailMessages.aiDetectedIntent,
          aiSentiment: emailMessages.aiSentiment,
          clientId: emailMessages.clientId,
          relatedTaskIds: emailMessages.relatedTaskIds,
          createdAt: emailMessages.createdAt,
        })
        .from(emailMessages)
        .where(and(...whereConditions))
        .orderBy(desc(emailMessages.receivedAt))
        .limit(limit);
    }

    // Normalize to FeedPost format
    const feedPosts: FeedPost[] = [
      ...callsData.map((call) => ({
        id: call.id,
        type: 'call' as const,
        timestamp: call.createdAt,
        from: call.callerName || call.callerPhone,
        fromIdentifier: call.callerPhone,
        subject: `${call.direction === 'inbound' ? 'Call from' : 'Call to'} ${call.callerName || call.callerPhone}`,
        preview: call.summary || call.transcription?.substring(0, 200) || null,
        fullContent: call.transcription || undefined,
        aiSummary: call.summary,
        sentiment: call.sentiment,
        intent: call.intent,
        isRead: true, // Calls are always "read"
        isHandled: false, // TODO: Track if call was handled
        isFlagged: false,
        priority: (call.sentiment === 'urgent' ? 'urgent' : 'normal') as 'urgent' | 'high' | 'normal' | 'low',
        clientId: call.clientId,
        duration: call.duration,
        direction: call.direction,
        recordingUrl: call.recordingUrl,
        transcription: call.transcription,
      })),
      ...emailsData.map((email) => ({
        id: email.id,
        type: 'email' as const,
        timestamp: email.receivedAt || email.createdAt,
        from: email.fromName || email.fromEmail,
        fromIdentifier: email.fromEmail,
        subject: email.subject || '(No Subject)',
        preview: email.bodyPreview || email.bodyText?.substring(0, 200) || null,
        fullContent: email.bodyHtml || email.bodyText || undefined,
        aiSummary: email.aiSummary,
        aiSuggestedActions: email.aiSuggestedActions as string[] | null,
        sentiment: email.aiSentiment,
        intent: email.aiDetectedIntent,
        isRead: email.isRead,
        isHandled: false, // TODO: Track if email was handled
        isFlagged: email.isFlagged,
        priority: (email.importance === 'high' ? 'urgent' :
                  email.importance === 'low' ? 'low' : 'normal') as 'urgent' | 'high' | 'normal' | 'low',
        userId: email.userId,
        clientId: email.clientId,
        relatedTaskIds: email.relatedTaskIds as string[],
        bodyHtml: email.bodyHtml || undefined,
        bodyText: email.bodyText || undefined,
        hasAttachments: email.hasAttachments,
        attachmentCount: email.attachmentCount,
      })),
    ];

    // Sort by timestamp (newest first)
    feedPosts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const paginatedPosts = feedPosts.slice(offset, offset + limit);

    const duration = Date.now() - startTime;

    logger.info('[Feed API] Fetched feed', {
      userId: user.id,
      filter,
      callsCount: callsData.length,
      emailsCount: emailsData.length,
      totalCount: paginatedPosts.length,
      duration,
    });

    return NextResponse.json({
      posts: paginatedPosts,
      stats: {
        calls: callsData.length,
        emails: emailsData.length,
        total: feedPosts.length,
        unread: feedPosts.filter(p => !p.isRead).length,
        urgent: feedPosts.filter(p => p.priority === 'urgent').length,
      },
      pagination: {
        limit,
        offset,
        hasMore: feedPosts.length > offset + limit,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('[Feed API] Failed to fetch feed', {
      error,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch feed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
