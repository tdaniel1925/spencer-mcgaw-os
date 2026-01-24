/**
 * Reply to Email API
 *
 * @route POST /api/emails/[id]/reply
 * @body { body: string, bodyType?: 'text' | 'html', replyAll?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const replySchema = z.object({
  body: z.string().min(1, "Reply body is required"),
  bodyType: z.enum(["text", "html"]).default("html"),
  replyAll: z.boolean().default(false),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
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
    const validated = replySchema.parse(body);

    await graphService.replyToEmail(
      params.id,
      validated.body,
      validated.bodyType,
      validated.replyAll
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error replying to email:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}
