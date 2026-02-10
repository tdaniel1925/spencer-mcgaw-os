/**
 * File Shares API
 *
 * @route POST /api/files/shares - Create share link with password & expiration
 * @route GET /api/files/shares - List user's share links
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const createShareSchema = z.object({
  fileId: z.string().uuid().optional(),
  folderId: z.string().uuid().optional(),
  permission: z.enum(["view", "download", "edit", "comment"]).default("view"),
  password: z.string().min(4).max(100).optional(),
  expiresAt: z.string().datetime().optional(),
  maxDownloads: z.number().int().positive().optional(),
  recipientEmail: z.string().email().optional(),
  message: z.string().max(1000).optional(),
}).refine(data => data.fileId || data.folderId, {
  message: "Either fileId or folderId must be provided",
});

/**
 * POST /api/files/shares - Create share link
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const validated = createShareSchema.parse(body);

    // Verify ownership of file or folder
    if (validated.fileId) {
      const { data: file, error: fileError } = await supabase
        .from("files")
        .select("id, owner_id, name")
        .eq("id", validated.fileId)
        .single();

      if (fileError || !file) {
        return NextResponse.json({ error: "File not found" }, { status: 404 });
      }

      if (file.owner_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    if (validated.folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, owner_id, name")
        .eq("id", validated.folderId)
        .single();

      if (folderError || !folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      if (folder.owner_id !== user.id) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
    }

    // Generate secure share token
    const shareToken = randomBytes(32).toString('base64url');

    // Hash password if provided
    let passwordHash: string | null = null;
    if (validated.password) {
      passwordHash = await bcrypt.hash(validated.password, 10);
    }

    // Create share link
    const { data: share, error: createError } = await supabase
      .from("file_shares")
      .insert({
        file_id: validated.fileId || null,
        folder_id: validated.folderId || null,
        share_token: shareToken,
        share_type: validated.recipientEmail ? 'email' : 'link',
        permission: validated.permission,
        password_hash: passwordHash,
        max_downloads: validated.maxDownloads || null,
        expires_at: validated.expiresAt || null,
        recipient_email: validated.recipientEmail || null,
        message: validated.message || null,
        created_by: user.id,
        is_active: true,
      })
      .select()
      .single();

    if (createError) {
      console.error("[File Shares] Create error:", createError);
      return NextResponse.json(
        { error: "Failed to create share link" },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("file_activity").insert({
      file_id: validated.fileId || null,
      folder_id: validated.folderId || null,
      user_id: user.id,
      action: "create_share",
      details: {
        share_id: share.id,
        permission: validated.permission,
        has_password: !!validated.password,
        has_expiration: !!validated.expiresAt,
        recipient_email: validated.recipientEmail || null,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    // Build share URL
    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const shareUrl = `${baseUrl}/share/${shareToken}`;

    return NextResponse.json({
      success: true,
      share: {
        ...share,
        shareUrl,
        passwordHash: undefined,
      },
    });
  } catch (error) {
    console.error("[File Shares] Unexpected error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/files/shares - List user's share links
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");

    let query = supabase
      .from("file_shares")
      .select(`
        *,
        files:file_id(id, name, mime_type),
        folders:folder_id(id, name)
      `)
      .eq("created_by", user.id)
      .order("created_at", { ascending: false });

    if (fileId) {
      query = query.eq("file_id", fileId);
    }

    const { data: shares, error: listError } = await query;

    if (listError) {
      console.error("[File Shares] List error:", listError);
      return NextResponse.json(
        { error: "Failed to list shares" },
        { status: 500 }
      );
    }

    // Build share URLs
    const baseUrl = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const sharesWithUrls = shares.map(share => ({
      ...share,
      shareUrl: `${baseUrl}/share/${share.share_token}`,
      passwordHash: undefined,
      hasPassword: !!share.password_hash,
    }));

    return NextResponse.json({
      success: true,
      shares: sharesWithUrls,
    });
  } catch (error) {
    console.error("[File Shares] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
