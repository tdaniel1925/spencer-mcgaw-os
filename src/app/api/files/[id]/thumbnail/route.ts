/**
 * Generate thumbnail for file
 *
 * @route GET /api/files/[id]/thumbnail - Get or generate thumbnail
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import sharp from "sharp";

const THUMBNAIL_SIZE = 300; // 300x300 thumbnails
const THUMBNAIL_QUALITY = 80;

/**
 * GET /api/files/[id]/thumbnail - Get or generate thumbnail
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: fileId } = await params;

    // Get file metadata
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("id, name, mime_type, storage_path, storage_bucket, thumbnail_path, preview_generated, owner_id")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check ownership
    if (file.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // If thumbnail already exists, return signed URL
    if (file.thumbnail_path && file.preview_generated) {
      const { data: thumbnailUrl } = await supabase.storage
        .from(file.storage_bucket)
        .createSignedUrl(file.thumbnail_path, 3600); // 1 hour expiry

      if (thumbnailUrl?.signedUrl) {
        return NextResponse.json({
          thumbnailUrl: thumbnailUrl.signedUrl,
          cached: true,
        });
      }
    }

    // Check if file type supports thumbnails
    const supportedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'image/bmp',
      'image/tiff',
    ];

    if (!supportedTypes.includes(file.mime_type)) {
      return NextResponse.json(
        { error: "Thumbnail generation not supported for this file type" },
        { status: 400 }
      );
    }

    // Download original file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(file.storage_bucket)
      .download(file.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Failed to download file for thumbnail generation" },
        { status: 500 }
      );
    }

    // Convert Blob to Buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Generate thumbnail using sharp
    let thumbnailBuffer: Buffer;

    try {
      thumbnailBuffer = await sharp(buffer)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
          fit: 'cover', // Crop to fill
          position: 'center',
        })
        .webp({ quality: THUMBNAIL_QUALITY }) // Convert to WebP for smaller size
        .toBuffer();
    } catch (sharpError) {
      console.error('[Thumbnail] Sharp error:', sharpError);
      return NextResponse.json(
        { error: "Failed to generate thumbnail" },
        { status: 500 }
      );
    }

    // Upload thumbnail to storage
    const thumbnailPath = `${file.storage_path.split('/').slice(0, -1).join('/')}/thumbnails/${fileId}.webp`;

    const { error: uploadError } = await supabase.storage
      .from(file.storage_bucket)
      .upload(thumbnailPath, thumbnailBuffer, {
        contentType: 'image/webp',
        upsert: true, // Overwrite if exists
      });

    if (uploadError) {
      console.error('[Thumbnail] Upload error:', uploadError);
      return NextResponse.json(
        { error: "Failed to upload thumbnail" },
        { status: 500 }
      );
    }

    // Update file record with thumbnail path
    await supabase
      .from("files")
      .update({
        thumbnail_path: thumbnailPath,
        preview_generated: true,
      })
      .eq("id", fileId);

    // Return signed URL for thumbnail
    const { data: thumbnailUrl } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(thumbnailPath, 3600);

    if (!thumbnailUrl?.signedUrl) {
      return NextResponse.json(
        { error: "Failed to create signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      thumbnailUrl: thumbnailUrl.signedUrl,
      cached: false,
      generated: true,
    });
  } catch (error) {
    console.error("[Thumbnail] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
