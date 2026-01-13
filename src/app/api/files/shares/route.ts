import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as bcrypt from "bcryptjs";

/**
 * POST /api/files/shares
 * Create a new share link with optional password protection
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      fileId,
      folderId,
      shareType = "link",
      permission = "download",
      password,
      expiresAt,
      maxDownloads,
      recipientEmail,
      message,
    } = body;

    if (!fileId && !folderId) {
      return NextResponse.json(
        { error: "Either fileId or folderId is required" },
        { status: 400 }
      );
    }

    // Verify file/folder ownership
    if (fileId) {
      const { data: file, error: fileError } = await supabase
        .from("files")
        .select("id, name, owner_id")
        .eq("id", fileId)
        .single();

      if (fileError || !file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      if (file.owner_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, name, owner_id")
        .eq("id", folderId)
        .single();

      if (folderError || !folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      if (folder.owner_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Hash password if provided
    let passwordHash: string | null = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Generate share token
    const shareToken = crypto.randomUUID();

    // Create share record
    const { data: share, error: createError } = await supabase
      .from("file_shares")
      .insert({
        file_id: fileId,
        folder_id: folderId,
        share_token: shareToken,
        share_type: shareType,
        permission,
        password_hash: passwordHash,
        expires_at: expiresAt,
        max_downloads: maxDownloads,
        recipient_email: recipientEmail,
        message,
        created_by: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error("[Shares API] Create error:", createError);
      throw createError;
    }

    // Log activity
    await supabase.from("file_activity").insert({
      file_id: fileId,
      folder_id: folderId,
      user_id: user.id,
      action: "create_share",
      details: {
        share_id: share.id,
        permission,
        has_password: !!password,
        has_expiry: !!expiresAt,
        max_downloads: maxDownloads,
      },
    });

    // Build share URL
    const origin = request.headers.get("origin") || request.nextUrl.origin;
    const shareUrl = `${origin}/share/${shareToken}`;

    return NextResponse.json({
      id: share.id,
      shareToken: shareToken,
      shareUrl,
      permission: share.permission,
      expiresAt: share.expires_at,
      maxDownloads: share.max_downloads,
      hasPassword: !!passwordHash,
      createdAt: share.created_at,
    });
  } catch (error) {
    console.error("[Shares API] Error:", error);
    return NextResponse.json(
      { error: "Failed to create share" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/files/shares?fileId=xxx
 * List shares for a file
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const fileId = searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json(
      { error: "fileId is required" },
      { status: 400 }
    );
  }

  try {
    // Verify file ownership
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("id, owner_id")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get shares
    const { data: shares, error: sharesError } = await supabase
      .from("file_shares")
      .select("*")
      .eq("file_id", fileId)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (sharesError) throw sharesError;

    const origin = request.headers.get("origin") || request.nextUrl.origin;

    return NextResponse.json({
      shares: (shares || []).map((s) => ({
        id: s.id,
        shareToken: s.share_token,
        shareUrl: `${origin}/share/${s.share_token}`,
        permission: s.permission,
        expiresAt: s.expires_at,
        maxDownloads: s.max_downloads,
        downloadCount: s.download_count,
        hasPassword: !!s.password_hash,
        recipientEmail: s.recipient_email,
        message: s.message,
        createdAt: s.created_at,
        lastAccessedAt: s.last_accessed_at,
      })),
    });
  } catch (error) {
    console.error("[Shares API] Error:", error);
    return NextResponse.json(
      { error: "Failed to get shares" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/files/shares?shareId=xxx
 * Revoke a share
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const shareId = searchParams.get("shareId");

  if (!shareId) {
    return NextResponse.json(
      { error: "shareId is required" },
      { status: 400 }
    );
  }

  try {
    // Verify share ownership
    const { data: share, error: shareError } = await supabase
      .from("file_shares")
      .select("id, created_by, file_id, folder_id")
      .eq("id", shareId)
      .single();

    if (shareError || !share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    if (share.created_by !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Revoke share
    const { error: updateError } = await supabase
      .from("file_shares")
      .update({ is_active: false })
      .eq("id", shareId);

    if (updateError) throw updateError;

    // Log activity
    await supabase.from("file_activity").insert({
      file_id: share.file_id,
      folder_id: share.folder_id,
      user_id: user.id,
      action: "revoke_share",
      details: { share_id: shareId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Shares API] Error:", error);
    return NextResponse.json(
      { error: "Failed to revoke share" },
      { status: 500 }
    );
  }
}
