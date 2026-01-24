/**
 * File Download API
 *
 * @route GET /api/files/[id]/download - Download file (generates signed URL)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/files/[id]/download - Generate signed download URL
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // Check ownership or shared access
    // TODO: Add shared file permission check here
    if (file.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Generate signed URL (1 hour expiration)
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 3600, {
        download: file.name,
      });

    if (urlError || !signedUrl) {
      console.error("[File Download] Signed URL error:", urlError);
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("file_activity").insert({
      file_id: id,
      folder_id: file.folder_id,
      user_id: user.id,
      action: "download",
      details: {
        file_name: file.name,
        size_bytes: file.size_bytes,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({
      downloadUrl: signedUrl.signedUrl,
      fileName: file.name,
      fileSize: file.size_bytes,
      mimeType: file.mime_type,
    });
  } catch (error) {
    console.error("[File Download] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to download file" }, { status: 500 });
  }
}
