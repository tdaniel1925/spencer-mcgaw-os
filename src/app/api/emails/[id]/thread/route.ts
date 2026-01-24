/**
 * Email Thread API - Get all emails in a conversation
 *
 * @route GET /api/emails/[id]/thread
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

    // First get the email to get its conversation ID
    const email = await graphService.getEmail(id);

    if (!email.conversationId) {
      return NextResponse.json({ thread: [email] });
    }

    // Get all emails in the conversation
    const thread = await graphService.getConversationEmails(email.conversationId);

    return NextResponse.json({ thread });
  } catch (error) {
    console.error("[API] Error fetching email thread:", error);
    return NextResponse.json({ error: "Failed to fetch email thread" }, { status: 500 });
  }
}
