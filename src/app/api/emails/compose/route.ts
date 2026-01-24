/**
 * Compose/Send Email API
 *
 * @route POST /api/emails/compose - Send new email
 * @route POST /api/emails/compose?draft=true - Create draft
 * @body SendEmailOptions
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const emailAddressSchema = z.object({
  name: z.string(),
  address: z.string().email(),
});

const composeSchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  bodyType: z.enum(["text", "html"]).default("html"),
  to: z.array(emailAddressSchema).min(1, "At least one recipient required"),
  cc: z.array(emailAddressSchema).optional(),
  bcc: z.array(emailAddressSchema).optional(),
  replyTo: z.array(emailAddressSchema).optional(),
  importance: z.enum(["low", "normal", "high"]).default("normal"),
  attachments: z
    .array(
      z.object({
        name: z.string(),
        contentType: z.string(),
        contentBytes: z.string(), // Base64 encoded
      })
    )
    .optional(),
});

export async function POST(request: NextRequest) {
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
    const validated = composeSchema.parse(body);

    const searchParams = request.nextUrl.searchParams;
    const isDraft = searchParams.get("draft") === "true";

    if (isDraft) {
      // Create draft
      const draft = await graphService.createDraft(validated);
      return NextResponse.json({ success: true, draft });
    } else {
      // Send immediately
      await graphService.sendEmail(validated);
      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("[API] Error sending email:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
