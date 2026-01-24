/**
 * Forward Email API
 *
 * @route POST /api/emails/[id]/forward
 * @body { to: EmailAddress[], body?: string, bodyType?: 'text' | 'html' }
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const emailAddressSchema = z.object({
  name: z.string(),
  address: z.string().email(),
});

const forwardSchema = z.object({
  to: z.array(emailAddressSchema).min(1, "At least one recipient required"),
  body: z.string().default(""),
  bodyType: z.enum(["text", "html"]).default("html"),
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
    const validated = forwardSchema.parse(body);

    await graphService.forwardEmail(
      params.id,
      validated.to,
      validated.body,
      validated.bodyType
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Error forwarding email:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request data", details: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: "Failed to forward email" }, { status: 500 });
  }
}
