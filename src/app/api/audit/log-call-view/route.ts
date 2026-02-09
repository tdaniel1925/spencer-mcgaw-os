/**
 * Call View Audit Logging API
 * POST /api/audit/log-call-view
 *
 * Logs when a user views a call for compliance tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logCallView, extractRequestMetadata } from "@/lib/audit/view-tracking";
import { z } from "zod";

const LogCallViewSchema = z.object({
  callId: z.string().uuid(),
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
    const { callId } = LogCallViewSchema.parse(body);

    // Log the call view
    await logCallView(callId, {
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
        error: "Failed to log call view",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
