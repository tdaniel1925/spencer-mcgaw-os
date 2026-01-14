import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as bcrypt from "bcryptjs";

interface RouteParams {
  params: Promise<{ token: string }>;
}

const MAX_PASSWORD_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MINUTES = 1;

// Database-backed rate limiter for serverless environments
async function checkPasswordRateLimit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shareId: string,
  ip: string
): Promise<{ allowed: boolean; remainingAttempts: number }> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000).toISOString();

  // Count recent failed attempts from file_activity
  const { data: recentAttempts, error } = await supabase
    .from("file_activity")
    .select("id")
    .eq("action", "share_password_attempt")
    .gte("created_at", windowStart)
    .or(`details->>share_id.eq.${shareId},details->>ip.eq.${ip}`);

  if (error) {
    console.error("Rate limit check error:", error);
    // On error, allow the attempt but log it
    return { allowed: true, remainingAttempts: MAX_PASSWORD_ATTEMPTS };
  }

  const attemptCount = recentAttempts?.length || 0;

  if (attemptCount >= MAX_PASSWORD_ATTEMPTS) {
    return { allowed: false, remainingAttempts: 0 };
  }

  return { allowed: true, remainingAttempts: MAX_PASSWORD_ATTEMPTS - attemptCount };
}

// Log a password attempt for rate limiting
async function logPasswordAttempt(
  supabase: Awaited<ReturnType<typeof createClient>>,
  shareId: string,
  ip: string,
  success: boolean
): Promise<void> {
  try {
    await supabase.from("file_activity").insert({
      action: "share_password_attempt",
      details: {
        share_id: shareId,
        ip: ip,
        success: success,
      },
      ip_address: ip,
    });
  } catch (err) {
    console.error("Failed to log password attempt:", err);
  }
}

/**
 * GET /api/files/share/[token]/download
 * Download a shared file (no auth required, but may need password)
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
        permission,
        password_hash,
        max_downloads,
        download_count,
        expires_at,
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

    // Check permission allows download
    if (share.permission === "view") {
      return NextResponse.json(
        { error: "This share link does not allow downloads" },
        { status: 403 }
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
          { error: "Password required" },
          { status: 401 }
        );
      }

      // Rate limit password attempts to prevent brute force
      const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
      const rateLimit = await checkPasswordRateLimit(supabase, share.id, ip);

      if (!rateLimit.allowed) {
        return NextResponse.json(
          { error: "Too many password attempts. Please try again later." },
          { status: 429 }
        );
      }

      const isValidPassword = await bcrypt.compare(providedPassword, share.password_hash);

      // Log the attempt (for rate limiting)
      await logPasswordAttempt(supabase, share.id, ip, isValidPassword);

      if (!isValidPassword) {
        return NextResponse.json(
          { error: "Invalid password", remainingAttempts: rateLimit.remainingAttempts - 1 },
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
      .select("id, name, storage_path, storage_bucket, owner_id")
      .eq("id", share.file_id)
      .single();

    if (fileError || !file) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Generate signed URL for download
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 3600, {
        download: file.name,
      });

    if (urlError || !signedUrl) {
      console.error("[Share Download] Signed URL error:", urlError);
      return NextResponse.json(
        { error: "Failed to generate download URL" },
        { status: 500 }
      );
    }

    // Increment download count
    await supabase
      .from("file_shares")
      .update({
        download_count: share.download_count + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq("id", share.id);

    // Log activity
    await supabase.from("file_activity").insert({
      file_id: file.id,
      user_id: share.created_by, // Log against the file owner
      action: "shared_download",
      details: {
        share_id: share.id,
        share_token: token,
        download_number: share.download_count + 1,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({
      downloadUrl: signedUrl.signedUrl,
      fileName: file.name,
    });
  } catch (error) {
    console.error("[Share Download] Error:", error);
    return NextResponse.json(
      { error: "Failed to download file" },
      { status: 500 }
    );
  }
}
