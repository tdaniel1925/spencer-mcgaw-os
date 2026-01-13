import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/goto";
import { createClient } from "@/lib/supabase/server";
import logger from "@/lib/logger";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/recordings/[id]
 *
 * Proxy endpoint to stream GoTo Connect recordings
 * This is needed because GoTo's recording URLs require OAuth authentication
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Authentication check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { id: recordingId } = await params;

  if (!recordingId) {
    return NextResponse.json({ error: "Recording ID required" }, { status: 400 });
  }

  // Check for debug mode
  const debug = request.nextUrl.searchParams.get("debug") === "true";

  logger.debug("[Recording Proxy] Fetching recording", { recordingId });

  try {
    // Get OAuth access token
    const accessToken = await getAccessToken();
    logger.debug("[Recording Proxy] Got access token");

    // First, try to get recording info to check if it exists and is ready
    const infoResponse = await fetch(
      `https://api.goto.com/recording/v1/recordings/${recordingId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (debug) {
      const infoData = infoResponse.ok ? await infoResponse.clone().json() : await infoResponse.text();
      logger.debug("[Recording Proxy] Recording info response", { status: infoResponse.status, data: infoData });
    }

    // Fetch the recording content info to get the token
    const contentResponse = await fetch(
      `https://api.goto.com/recording/v1/recordings/${recordingId}/content`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!contentResponse.ok) {
      const errorText = await contentResponse.text();
      logger.error("[Recording Proxy] Failed to get content token", undefined, { status: contentResponse.status, error: errorText });

      // If 404, the recording might not exist or might be from a different service
      if (contentResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Recording not found",
            details: "This recording may still be processing, may have expired, or the ID format may be incorrect.",
            recordingId,
            rawError: errorText,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Failed to get recording access: ${contentResponse.status}`, details: errorText },
        { status: contentResponse.status }
      );
    }

    const contentData = await contentResponse.json();
    logger.debug("[Recording Proxy] Content response", { status: contentData.status });

    // Check if recording is still processing
    if (contentData.status === "PROCESSING" || contentData.status === "PENDING") {
      logger.debug("[Recording Proxy] Recording still processing", { status: contentData.status });
      return NextResponse.json(
        { error: "Recording is still processing, please try again later" },
        { status: 202 }
      );
    }

    if (!contentData.token?.token) {
      logger.error("[Recording Proxy] No token in response", undefined, { status: contentData.status });
      return NextResponse.json(
        { error: "No recording token available" },
        { status: 404 }
      );
    }

    // Now fetch the actual recording using the token
    const downloadUrl = `https://api.goto.com/recording/v1/recordings/${recordingId}/download?token=${encodeURIComponent(contentData.token.token)}`;
    logger.debug("[Recording Proxy] Fetching from download URL");

    const recordingResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    logger.debug("[Recording Proxy] Download response", { status: recordingResponse.status });

    if (!recordingResponse.ok) {
      logger.debug("[Recording Proxy] Trying media endpoint");
      // Try alternate endpoint
      const altResponse = await fetch(
        `https://api.goto.com/recording/v1/recordings/${recordingId}/media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      logger.debug("[Recording Proxy] Media endpoint response", { status: altResponse.status });

      if (!altResponse.ok) {
        const errorText = await altResponse.text();
        logger.error("[Recording Proxy] Failed to fetch recording", undefined, { status: altResponse.status, error: errorText });
        return NextResponse.json(
          { error: `Failed to fetch recording: ${altResponse.status}` },
          { status: altResponse.status }
        );
      }

      // Stream the response
      const audioData = await altResponse.arrayBuffer();
      logger.debug("[Recording Proxy] Got audio data from media endpoint", { bytes: audioData.byteLength });
      return new NextResponse(audioData, {
        headers: {
          "Content-Type": altResponse.headers.get("Content-Type") || "audio/mpeg",
          "Content-Length": audioData.byteLength.toString(),
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    // Stream the recording response
    const audioData = await recordingResponse.arrayBuffer();
    logger.debug("[Recording Proxy] Got audio data", { bytes: audioData.byteLength });
    return new NextResponse(audioData, {
      headers: {
        "Content-Type": recordingResponse.headers.get("Content-Type") || "audio/mpeg",
        "Content-Length": audioData.byteLength.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    logger.error("[Recording Proxy] Error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
