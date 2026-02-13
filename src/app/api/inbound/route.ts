/**
 * Inbound Communications API
 * GET /api/inbound
 *
 * Returns unified feed of phone calls and emails sorted by date.
 * Filters out calls with no substance (voicemail, wrong numbers, spam).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { calls, emailMessages, emailConnections } from '@/db/schema';
import { desc, and, eq, not, inArray, or, isNull } from 'drizzle-orm';
import logger from '@/lib/logger';

// Filter out these call categories
const EXCLUDED_CALL_CATEGORIES = ['voicemail', 'wrong_number', 'spam'];

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

    // Get search params
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const type = searchParams.get('type'); // 'phone' | 'email' | undefined (all)
    const emailVisibility = searchParams.get('emailVisibility'); // 'personal' | 'org' | 'all' | undefined (all)

    // Fetch calls (excluding voicemail, wrong numbers, spam)
    let callsData: any[] = [];
    if (!type || type === 'phone') {
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
          transferredToId: calls.transferredToId,
          recordingUrl: calls.recordingUrl,
          metadata: calls.metadata,
          createdAt: calls.createdAt,
        })
        .from(calls)
        .orderBy(desc(calls.createdAt))
        .limit(limit);

      callsData = await callsQuery;

      // Filter out excluded categories (metadata.category check)
      callsData = callsData.filter((call) => {
        const category = (call.metadata as any)?.category;
        return !EXCLUDED_CALL_CATEGORIES.includes(category);
      });
    }

    // Fetch emails
    let emailsData: any[] = [];
    if (!type || type === 'email') {
      // For now, ignore emailVisibility filter until is_global column is added to production
      // TODO: Remove this fallback after migration runs in production
      const baseFilter = and(
        not(eq(emailMessages.isDeleted, true)),
        not(eq(emailMessages.isArchived, true))
      );

      emailsData = await db
        .select({
          id: emailMessages.id,
          userId: emailMessages.userId,
          connectionId: emailMessages.connectionId,
          connectionEmail: emailConnections.email, // Email account this came from
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
        .leftJoin(emailConnections, eq(emailMessages.connectionId, emailConnections.id))
        .where(baseFilter)
        .orderBy(desc(emailMessages.receivedAt))
        .limit(limit);
    }

    // Combine and normalize data
    const communications = [
      ...callsData.map((call) => ({
        id: call.id,
        type: 'phone' as const,
        timestamp: call.createdAt,
        from: call.callerName || call.callerPhone,
        fromIdentifier: call.callerPhone,
        subject: `Call from ${call.callerName || call.callerPhone}`,
        preview: call.summary || call.transcription?.substring(0, 200),
        duration: call.duration,
        direction: call.direction,
        status: call.status,
        aiSummary: call.summary,
        sentiment: call.sentiment,
        intent: call.intent,
        recordingUrl: call.recordingUrl,
        transcription: call.transcription,
        clientId: call.clientId,
        transferredToId: call.transferredToId,
        metadata: call.metadata,
      })),
      ...emailsData.map((email) => ({
        id: email.id,
        type: 'email' as const,
        timestamp: email.receivedAt || email.createdAt,
        from: email.fromName || email.fromEmail,
        fromIdentifier: email.fromEmail,
        subject: email.subject || '(No Subject)',
        preview: email.bodyPreview || email.bodyText?.substring(0, 200),
        importance: email.importance,
        hasAttachments: email.hasAttachments,
        attachmentCount: email.attachmentCount,
        isRead: email.isRead,
        isFlagged: email.isFlagged,
        category: email.category,
        priorityScore: email.priorityScore,
        aiSummary: email.aiSummary,
        aiSuggestedActions: email.aiSuggestedActions,
        aiDetectedIntent: email.aiDetectedIntent,
        aiSentiment: email.aiSentiment,
        clientId: email.clientId,
        relatedTaskIds: email.relatedTaskIds,
        bodyHtml: email.bodyHtml,
        bodyText: email.bodyText,
        userId: email.userId, // Include userId to detect unassigned emails (NULL)
        connectionEmail: email.connectionEmail, // Email account this came from
      })),
    ];

    // Sort by timestamp (newest first)
    communications.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Apply final limit
    const limitedCommunications = communications.slice(0, limit);

    const duration = Date.now() - startTime;

    logger.info('[Inbound API] Fetched communications', {
      userId: user.id,
      type: type || 'all',
      emailVisibility: emailVisibility || 'all',
      callsCount: callsData.length,
      emailsCount: emailsData.length,
      totalCount: limitedCommunications.length,
      duration,
    });

    return NextResponse.json({
      communications: limitedCommunications,
      stats: {
        calls: callsData.length,
        emails: emailsData.length,
        total: limitedCommunications.length,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('[Inbound API] Failed to fetch communications', {
      error,
      duration,
    });

    return NextResponse.json(
      {
        error: 'Failed to fetch communications',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
