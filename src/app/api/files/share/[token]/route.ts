import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as bcrypt from "bcryptjs";

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/files/share/[token]
 * Get share info for public access (no auth required)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { token } = await params;
  const supabase = await createClient();

  try {
    // Find the share by token
    const { data: share, error: shareError } = await supabase
      .from("file_shares")
      .select(`
        id,
        file_id,
        folder_id,
        share_type,
        permission,
        password_hash,
        max_downloads,
        download_count,
        expires_at,
        message,
        is_active,
        created_by
      `)
      .eq("share_token", token)
      .single();

    if (shareError || !share) {
      return NextResponse.json(
        { error: "Share link not found" },
        { status: 404 }
      );
    }

    // Check if share is active
    if (!share.is_active) {
      return NextResponse.json(
        { error: "This share link has been revoked" },
        { status: 410 }
      );
    }

    // Check expiration
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "This share link has expired" },
        { status: 410 }
      );
    }

    // Check download limit
    if (share.max_downloads && share.download_count >= share.max_downloads) {
      return NextResponse.json(
        { error: "This share link has reached its download limit" },
        { status: 410 }
      );
    }

    // Check password if required
    if (share.password_hash) {
      const providedPassword = request.headers.get("X-Share-Password");

      if (!providedPassword) {
        return NextResponse.json(
          { error: "Password required", requiresPassword: true },
          { status: 401 }
        );
      }

      const isValidPassword = await bcrypt.compare(providedPassword, share.password_hash);
      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Invalid password" },
          { status: 401 }
        );
      }
    }

    // Get file details
    if (!share.file_id) {
      return NextResponse.json(
        { error: "Folder sharing not yet supported" },
        { status: 400 }
      );
    }

    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("id, name, size_bytes, mime_type, owner_id")
      .eq("id", share.file_id)
      .single();

    if (fileError || !file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Get owner name
    const { data: owner } = await supabase
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", file.owner_id)
      .single();

    // Update last accessed
    await supabase
      .from("file_shares")
      .update({ last_accessed_at: new Date().toISOString() })
      .eq("id", share.id);

    return NextResponse.json({
      id: share.id,
      fileName: file.name,
      fileSize: file.size_bytes,
      mimeType: file.mime_type,
      sharedBy: owner?.full_name || owner?.email || "Unknown",
      expiresAt: share.expires_at,
      requiresPassword: !!share.password_hash,
      permission: share.permission,
      downloadCount: share.download_count,
      maxDownloads: share.max_downloads,
      message: share.message,
    });
  } catch (error) {
    console.error("[Share API] Error:", error);
    return NextResponse.json(
      { error: "Failed to load share" },
      { status: 500 }
    );
  }
}
