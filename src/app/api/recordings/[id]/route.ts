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

  try {
    // Get OAuth access token
    const accessToken = await getAccessToken();

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
      console.error("[Recording Proxy] Failed to get content token:", error);
      return NextResponse.json(
        { error: "Failed to get recording access" },
        { status: contentResponse.status }
      );
    }

    const contentData = await contentResponse.json();

    if (!contentData.token?.token) {
      return NextResponse.json(
        { error: "No recording token available" },
        { status: 404 }
      );
    }

    // Now fetch the actual recording using the token
    const downloadUrl = `https://api.goto.com/recording/v1/recordings/${recordingId}/download?token=${encodeURIComponent(contentData.token.token)}`;

    const recordingResponse = await fetch(downloadUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!recordingResponse.ok) {
      // Try alternate endpoint
      const altResponse = await fetch(
        `https://api.goto.com/recording/v1/recordings/${recordingId}/media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!altResponse.ok) {
        const error = await altResponse.text();
        console.error("[Recording Proxy] Failed to fetch recording:", error);
        return NextResponse.json(
          { error: "Failed to fetch recording" },
          { status: altResponse.status }
        );
      }

      // Stream the response
      const audioData = await altResponse.arrayBuffer();
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
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
