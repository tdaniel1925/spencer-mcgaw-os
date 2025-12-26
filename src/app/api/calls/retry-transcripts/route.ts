import { NextResponse } from "next/server";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getTranscription } from "@/lib/goto";
import { eq, isNull, isNotNull, sql, desc, and } from "drizzle-orm";
import logger from "@/lib/logger";

/**
 * GET - Get calls missing transcripts (for diagnosis)
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Find calls that have recording IDs but no transcript
    const callsMissingTranscripts = await db
      .select({
        id: calls.id,
        callerPhone: calls.callerPhone,
        callerName: calls.callerName,
        duration: calls.duration,
        recordingUrl: calls.recordingUrl,
        transcription: calls.transcription,
        metadata: calls.metadata,
        createdAt: calls.createdAt,
      })
      .from(calls)
      .where(
        and(
          isNull(calls.transcription),
          isNotNull(calls.metadata),
          sql`${calls.metadata}::jsonb ? 'recordingIds'`
        )
      )
      .orderBy(desc(calls.createdAt))
      .limit(50);

    // Get counts
    const [totalCalls] = await db
      .select({ count: sql<number>`count(*)` })
      .from(calls);

    const [callsWithTranscripts] = await db
      .select({ count: sql<number>`count(*)` })
      .from(calls)
      .where(isNotNull(calls.transcription));

    return NextResponse.json({
      success: true,
      stats: {
        totalCalls: totalCalls?.count || 0,
        withTranscripts: callsWithTranscripts?.count || 0,
        missingTranscripts: callsMissingTranscripts.length,
      },
      callsMissingTranscripts: callsMissingTranscripts.map(call => ({
        id: call.id,
        callerPhone: call.callerPhone,
        callerName: call.callerName,
        duration: call.duration,
        hasRecording: !!call.recordingUrl,
        recordingIds: (call.metadata as Record<string, unknown>)?.recordingIds || [],
        createdAt: call.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Error fetching calls missing transcripts:", error);
    return NextResponse.json(
      { error: "Failed to fetch calls" },
      { status: 500 }
    );
  }
}

/**
 * POST - Retry fetching transcripts for calls missing them
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { callId, retryAll } = body as { callId?: string; retryAll?: boolean };

    const results: Array<{
      callId: string;
      success: boolean;
      error?: string;
      transcriptLength?: number;
    }> = [];

    // Get calls to retry
    let callsToRetry: Array<{
      id: string;
      metadata: unknown;
    }> = [];

    if (callId) {
      // Retry specific call
      const [call] = await db
        .select({ id: calls.id, metadata: calls.metadata })
        .from(calls)
        .where(eq(calls.id, callId))
        .limit(1);

      if (call) {
        callsToRetry = [call];
      }
    } else if (retryAll) {
      // Retry all calls missing transcripts (limit to 20 to avoid timeout)
      callsToRetry = await db
        .select({ id: calls.id, metadata: calls.metadata })
        .from(calls)
        .where(
          and(
            isNull(calls.transcription),
            isNotNull(calls.metadata),
            sql`${calls.metadata}::jsonb ? 'recordingIds'`
          )
        )
        .orderBy(desc(calls.createdAt))
        .limit(20);
    }

    // Process each call
    for (const call of callsToRetry) {
      const metadata = call.metadata as Record<string, unknown>;
      const recordingIds = metadata?.recordingIds as string[] || [];

      if (recordingIds.length === 0) {
        results.push({
          callId: call.id,
          success: false,
          error: "No recording IDs found",
        });
        continue;
      }

      // Try each recording ID
      let transcriptFound = false;
      for (const recordingId of recordingIds) {
        try {
          const transcriptData = await getTranscription(recordingId);

          if (transcriptData.text && transcriptData.text.length > 0) {
            // Update the call with the transcript
            await db
              .update(calls)
              .set({
                transcription: transcriptData.text,
                metadata: sql`${calls.metadata}::jsonb || jsonb_build_object('transcriptionRetrySuccess', true, 'transcriptionRetriedAt', ${new Date().toISOString()})`,
              })
              .where(eq(calls.id, call.id));

            results.push({
              callId: call.id,
              success: true,
              transcriptLength: transcriptData.text.length,
            });
            transcriptFound = true;
            break;
          }
        } catch (error) {
          logger.error("[Retry Transcripts] Error for recording:", error, { recordingId });
        }
      }

      if (!transcriptFound) {
        // Mark that we tried
        await db
          .update(calls)
          .set({
            metadata: sql`${calls.metadata}::jsonb || jsonb_build_object('transcriptionRetryFailed', true, 'transcriptionRetriedAt', ${new Date().toISOString()})`,
          })
          .where(eq(calls.id, call.id));

        results.push({
          callId: call.id,
          success: false,
          error: "Could not fetch transcript from any recording ID - transcription may not be enabled in GoTo",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} calls: ${successCount} succeeded, ${failCount} failed`,
      results,
    });
  } catch (error) {
    logger.error("Error retrying transcripts:", error);
    return NextResponse.json(
      { error: "Failed to retry transcripts" },
      { status: 500 }
    );
  }
}
