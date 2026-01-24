/**
 * Email Attachments API - List and download attachments
 *
 * @route GET /api/emails/[id]/attachments - List all attachments
 * @route GET /api/emails/[id]/attachments?download=[attachmentId] - Download specific attachment
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const graphService = await GraphEmailService.fromConnection(user.id);
    if (!graphService) {
      return NextResponse.json(
        { error: "Email not connected", needsConnection: true },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const downloadId = searchParams.get("download");

    // If downloading specific attachment
    if (downloadId) {
      const attachment = await graphService.getAttachment(id, downloadId);

      // Return attachment as file download
      if (attachment.contentBytes) {
        const buffer = Buffer.from(attachment.contentBytes, "base64");

        return new NextResponse(buffer, {
          headers: {
            "Content-Type": attachment.contentType,
            "Content-Disposition": `attachment; filename="${attachment.name}"`,
            "Content-Length": attachment.size.toString(),
          },
        });
      }

      return NextResponse.json({ error: "Attachment content not available" }, { status: 404 });
    }

    // List all attachments
    const attachments = await graphService.getAttachments(id);

    return NextResponse.json({ attachments });
  } catch (error) {
    console.error("[API] Error fetching attachments:", error);
    return NextResponse.json({ error: "Failed to fetch attachments" }, { status: 500 });
  }
}
