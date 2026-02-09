/**
 * Email View Audit Logging API
 * POST /api/audit/log-email-view
 *
 * Logs when a user views an email for compliance tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logEmailView, extractRequestMetadata } from "@/lib/audit/view-tracking";
import { z } from "zod";

const LogEmailViewSchema = z.object({
  emailId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const { emailId } = LogEmailViewSchema.parse(body);

    // Log the email view
    await logEmailView(emailId, {
      userId: user.id,
      userEmail: user.email,
      ...extractRequestMetadata(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to log email view",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
