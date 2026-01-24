/**
 * Single Email API - GET, PATCH, DELETE operations
 *
 * @route GET /api/emails/[id] - Get email details
 * @route PATCH /api/emails/[id] - Update email (mark read, flag, etc)
 * @route DELETE /api/emails/[id] - Delete email
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

    const email = await graphService.getEmail(id);

    return NextResponse.json({ email });
  } catch (error) {
    console.error("[API] Error fetching email:", error);
    return NextResponse.json({ error: "Failed to fetch email" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();

    // Handle different update operations
    if (body.isRead !== undefined) {
      await graphService.markAsRead(id, body.isRead);
    }

    if (body.flagged !== undefined) {
      await graphService.flagEmail(id, body.flagged);
    }

    if (body.folderId) {
      await graphService.moveToFolder(id, body.folderId);
    }

    // Fetch updated email
    const email = await graphService.getEmail(id);

    return NextResponse.json({ email, success: true });
  } catch (error) {
    console.error("[API] Error updating email:", error);
    return NextResponse.json({ error: "Failed to update email" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    const permanent = searchParams.get("permanent") === "true";

    if (permanent) {
      await graphService.permanentlyDeleteEmail(id);
    } else {
      await graphService.deleteEmail(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error deleting email:", error);
    return NextResponse.json({ error: "Failed to delete email" }, { status: 500 });
  }
}
