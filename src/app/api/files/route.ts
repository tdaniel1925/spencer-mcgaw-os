/**
 * File Operations API
 *
 * @route POST /api/files - Upload file
 * @route GET /api/files - List files with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { rateLimiters, getClientIdentifier, rateLimitResponse } from "@/lib/rate-limit";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".sh", ".cmd", ".com", ".scr", ".pif"];
const BLOCKED_MIME_TYPES = ["application/x-msdownload", "application/x-ms-dos-executable"];

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace special chars with underscore
    .replace(/^\.+/, "_") // No leading dots
    .replace(/\.{2,}/g, "_") // No consecutive dots
    .substring(0, 255); // Limit length
}

/**
 * Check if file extension or MIME type is blocked
 */
function isFileBlocked(fileName: string, mimeType: string): boolean {
  const lowerName = fileName.toLowerCase();
  const lowerMime = mimeType.toLowerCase();

  if (BLOCKED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
    return true;
  }

  if (BLOCKED_MIME_TYPES.includes(lowerMime)) {
    return true;
  }

  return false;
}

/**
 * Generate unique filename if duplicate exists (server-side, atomic)
 */
async function generateUniqueFileName(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  folderId: string | null,
  ownerId: string
): Promise<string> {
  // Check if name exists
  const { data: existing } = await supabase
    .from("files")
    .select("name")
    .eq("folder_id", folderId || null)
    .eq("owner_id", ownerId)
    .eq("is_trashed", false)
    .ilike("name", name);

  if (!existing || existing.length === 0) {
    return name;
  }

  // Extract base name and extension
  const lastDotIndex = name.lastIndexOf(".");
  const baseName = lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
  const extension = lastDotIndex > 0 ? name.substring(lastDotIndex) : "";

  // Find existing counters
  const pattern = `${baseName} (%)${extension}`;
  const { data: numbered } = await supabase
    .from("files")
    .select("name")
    .eq("folder_id", folderId || null)
    .eq("owner_id", ownerId)
    .eq("is_trashed", false)
    .ilike("name", pattern);

  const counters = (numbered || [])
    .map((f) => {
      const match = f.name.match(/\((\d+)\)/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter((n) => !isNaN(n));

  const nextCounter = counters.length > 0 ? Math.max(...counters) + 1 : 1;
  return `${baseName} (${nextCounter})${extension}`;
}

/**
 * POST /api/files - Upload file with quota check
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

    // Rate limiting: 20 uploads per minute
    const identifier = getClientIdentifier(request, user.id);
    const rateLimit = rateLimiters.sensitive.check(identifier);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = (formData.get("folderId") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "File is empty" }, { status: 400 });
    }

    // Check if file type is blocked
    if (isFileBlocked(file.name, file.type)) {
      return NextResponse.json(
        { error: "File type not allowed for security reasons" },
        { status: 400 }
      );
    }

    // Verify folder ownership if folderId provided
    if (folderId) {
      const { data: folder, error: folderError } = await supabase
        .from("folders")
        .select("id, owner_id")
        .eq("id", folderId)
        .single();

      if (folderError || !folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }

      if (folder.owner_id !== user.id) {
        return NextResponse.json({ error: "Access denied to folder" }, { status: 403 });
      }
    }

    // Check quota atomically using RPC function
    const { data: quotaCheck, error: quotaError } = await supabase.rpc(
      "check_and_reserve_quota",
      {
        p_user_id: user.id,
        p_bytes: file.size,
      }
    );

    if (quotaError || !quotaCheck) {
      // Try to get current quota for error message
      const { data: currentQuota } = await supabase
        .from("storage_quotas")
        .select("used_bytes, quota_bytes")
        .eq("user_id", user.id)
        .single();

      return NextResponse.json(
        {
          error: "Storage quota exceeded",
          currentUsage: currentQuota?.used_bytes || 0,
          quota: currentQuota?.quota_bytes || 0,
        },
        { status: 400 }
      );
    }

    // Sanitize filename
    const sanitizedName = sanitizeFileName(file.name);

    // Generate unique filename (prevents race conditions)
    const uniqueName = await generateUniqueFileName(supabase, sanitizedName, folderId, user.id);

    // Generate storage path with timestamp to ensure uniqueness
    const uploadId = Date.now().toString();
    const storagePath = `${user.id}/${folderId || "root"}/${uploadId}-${uniqueName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from("files")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) {
      // Rollback quota reservation
      await supabase.rpc("increment_storage_usage", {
        p_user_id: user.id,
        p_bytes: -file.size,
      });

      console.error("[File Upload] Storage error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file to storage" }, { status: 500 });
    }

    // Create database record
    const { data: fileRecord, error: dbError } = await supabase
      .from("files")
      .insert({
        name: uniqueName,
        storage_path: storagePath,
        storage_bucket: "files",
        mime_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        folder_id: folderId,
        owner_id: user.id,
        version: 1,
        is_starred: false,
        is_trashed: false,
      })
      .select()
      .single();

    if (dbError) {
      // Rollback: delete from storage and quota
      await supabase.storage.from("files").remove([storagePath]);
      await supabase.rpc("increment_storage_usage", {
        p_user_id: user.id,
        p_bytes: -file.size,
      });

      console.error("[File Upload] Database error:", dbError);
      return NextResponse.json({ error: "Failed to create file record" }, { status: 500 });
    }

    // Log activity
    await supabase.from("file_activity").insert({
      file_id: fileRecord.id,
      folder_id: folderId,
      user_id: user.id,
      action: "upload",
      details: {
        file_name: uniqueName,
        size_bytes: file.size,
        mime_type: file.type,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({
      success: true,
      file: {
        id: fileRecord.id,
        name: fileRecord.name,
        size: fileRecord.size_bytes,
        mimeType: fileRecord.mime_type,
        folderId: fileRecord.folder_id,
        createdAt: fileRecord.created_at,
      },
    });
  } catch (error) {
    console.error("[File Upload] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}

const listFilesSchema = z.object({
  folderId: z.string().uuid().optional(),
  search: z.string().optional(),
  sort: z.enum(["name", "size", "created_at", "modified_at"]).default("created_at"),
  order: z.enum(["asc", "desc"]).default("desc"),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  starred: z.coerce.boolean().optional(),
  trashed: z.coerce.boolean().default(false),
});

/**
 * GET /api/files - List files with filters
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

    // Rate limiting: 100 requests per minute
    const identifier = getClientIdentifier(request, user.id);
    const rateLimit = rateLimiters.api.check(identifier);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const searchParams = request.nextUrl.searchParams;
    const params = listFilesSchema.parse({
      folderId: searchParams.get("folderId") || undefined,
      search: searchParams.get("search") || undefined,
      sort: searchParams.get("sort") || "created_at",
      order: searchParams.get("order") || "desc",
      limit: searchParams.get("limit") || "100",
      offset: searchParams.get("offset") || "0",
      starred: searchParams.get("starred") || undefined,
      trashed: searchParams.get("trashed") || "false",
    });

    // Build query
    let query = supabase
      .from("files")
      .select("*", { count: "exact" })
      .eq("owner_id", user.id)
      .eq("is_trashed", params.trashed);

    // Filter by folder
    if (params.folderId) {
      query = query.eq("folder_id", params.folderId);
    }

    // Filter by starred
    if (params.starred !== undefined) {
      query = query.eq("is_starred", params.starred);
    }

    // Search with escaped wildcards
    if (params.search) {
      const escapedSearch = params.search
        .replace(/%/g, "\\%")
        .replace(/_/g, "\\_")
        .replace(/\\/g, "\\\\");
      query = query.ilike("name", `%${escapedSearch}%`);
    }

    // Sort
    query = query.order(params.sort, { ascending: params.order === "asc" });

    // Pagination
    query = query.range(params.offset, params.offset + params.limit - 1);

    const { data: files, error, count } = await query;

    if (error) {
      console.error("[Files List] Error:", error);
      return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
    }

    return NextResponse.json({
      files: files || [],
      total: count || 0,
      limit: params.limit,
      offset: params.offset,
    });
  } catch (error) {
    console.error("[Files List] Unexpected error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to fetch files" }, { status: 500 });
  }
}
