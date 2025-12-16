import { NextRequest, NextResponse } from "next/server";
import { getAccessToken } from "@/lib/goto";

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
  const { id: recordingId } = await params;

  if (!recordingId) {
    return NextResponse.json({ error: "Recording ID required" }, { status: 400 });
  }

  // Check for debug mode
  const debug = request.nextUrl.searchParams.get("debug") === "true";

  console.log("[Recording Proxy] Fetching recording:", recordingId);

  try {
    // Get OAuth access token
    const accessToken = await getAccessToken();
    console.log("[Recording Proxy] Got access token");

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
      console.log("[Recording Proxy] Recording info response:", infoResponse.status, infoData);
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
      const error = await contentResponse.text();
      console.error("[Recording Proxy] Failed to get content token:", contentResponse.status, error);

      // If 404, the recording might not exist or might be from a different service
      if (contentResponse.status === 404) {
        return NextResponse.json(
          {
            error: "Recording not found",
            details: "This recording may still be processing, may have expired, or the ID format may be incorrect.",
            recordingId,
            rawError: error,
          },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Failed to get recording access: ${contentResponse.status}`, details: error },
        { status: contentResponse.status }
      );
    }

    const contentData = await contentResponse.json();
    console.log("[Recording Proxy] Content response status:", contentData.status);

    // Check if recording is still processing
    if (contentData.status === "PROCESSING" || contentData.status === "PENDING") {
      console.log("[Recording Proxy] Recording still processing:", contentData.status);
      return NextResponse.json(
        { error: "Recording is still processing, please try again later" },
        { status: 202 }
      );
    }

    if (!contentData.token?.token) {
      console.error("[Recording Proxy] No token in response, status:", contentData.status);
      return NextResponse.json(
        { error: "No recording token available" },
        { status: 404 }
      );
    }

    // Now fetch the actual recording using the token
    const downloadUrl = `https://api.goto.com/recording/v1/recordings/${recordingId}/download?token=${encodeURIComponent(contentData.token.token)}`;
    console.log("[Recording Proxy] Fetching from download URL...");

    const recordingResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    console.log("[Recording Proxy] Download response status:", recordingResponse.status);

    if (!recordingResponse.ok) {
      console.log("[Recording Proxy] Trying media endpoint...");
      // Try alternate endpoint
      const altResponse = await fetch(
        `https://api.goto.com/recording/v1/recordings/${recordingId}/media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      console.log("[Recording Proxy] Media endpoint status:", altResponse.status);

      if (!altResponse.ok) {
        const error = await altResponse.text();
        console.error("[Recording Proxy] Failed to fetch recording:", error);
        return NextResponse.json(
          { error: `Failed to fetch recording: ${altResponse.status}` },
          { status: altResponse.status }
        );
      }

      // Stream the response
      const audioData = await altResponse.arrayBuffer();
      console.log("[Recording Proxy] Got audio data from media endpoint:", audioData.byteLength, "bytes");
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
    console.log("[Recording Proxy] Got audio data:", audioData.byteLength, "bytes");
    return new NextResponse(audioData, {
      headers: {
        "Content-Type": recordingResponse.headers.get("Content-Type") || "audio/mpeg",
        "Content-Length": audioData.byteLength.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[Recording Proxy] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
