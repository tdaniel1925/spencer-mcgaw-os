/**
 * File Restore API
 *
 * @route POST /api/files/[id]/restore - Restore file from trash
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/files/[id]/restore - Restore file from trash
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get file
    const { data: file, error: fetchError } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    if (!file.is_trashed) {
      return NextResponse.json({ error: "File is not in trash" }, { status: 400 });
    }

    // Restore file
    const { data: restoredFile, error: restoreError } = await supabase
      .from("files")
      .update({
        is_trashed: false,
        trashed_at: null,
        modified_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (restoreError) {
      console.error("[File Restore] Error:", restoreError);
      return NextResponse.json({ error: "Failed to restore file" }, { status: 500 });
    }

    // Log activity
    await supabase.from("file_activity").insert({
      file_id: id,
      folder_id: file.folder_id,
      user_id: user.id,
      action: "restore",
      details: {
        file_name: file.name,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ success: true, file: restoredFile });
  } catch (error) {
    console.error("[File Restore] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to restore file" }, { status: 500 });
  }
}
