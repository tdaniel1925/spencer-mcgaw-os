/**
 * Restore File Version API
 *
 * @route POST /api/files/[id]/versions/[versionId]/restore - Restore a previous version
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/files/[id]/versions/[versionId]/restore - Restore version
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: fileId, versionId } = await params;

    // Get file to verify ownership
    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("id, name, owner_id, storage_bucket, storage_path, version, current_version_id")
      .eq("id", fileId)
      .single();

    if (fileError || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    if (file.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get the version to restore
    const { data: versionToRestore, error: versionError } = await supabase
      .from("file_versions")
      .select("id, version_number, storage_path, storage_bucket, size_bytes, checksum")
      .eq("id", versionId)
      .eq("file_id", fileId)
      .single();

    if (versionError || !versionToRestore) {
      return NextResponse.json({ error: "Version not found" }, { status: 404 });
    }

    // Download the version file from storage
    const { data: versionFileData, error: downloadError } = await supabase.storage
      .from(versionToRestore.storage_bucket)
      .download(versionToRestore.storage_path);

    if (downloadError || !versionFileData) {
      return NextResponse.json(
        { error: "Failed to download version file" },
        { status: 500 }
      );
    }

    // Before replacing, save current version as a backup
    const currentVersionNumber = file.version;

    // Create a new version entry for the current file (before restore)
    await supabase.from("file_versions").insert({
      file_id: fileId,
      version_number: currentVersionNumber,
      storage_path: file.storage_path,
      storage_bucket: file.storage_bucket,
      size_bytes: 0, // Will be updated if needed
      checksum: null,
      change_summary: `Backup before restoring to version ${versionToRestore.version_number}`,
      created_by: user.id,
    });

    // Upload the restored version to the main file path
    const { error: uploadError } = await supabase.storage
      .from(file.storage_bucket)
      .upload(file.storage_path, versionFileData, {
        upsert: true, // Overwrite current file
      });

    if (uploadError) {
      console.error("[Restore Version] Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to restore version" },
        { status: 500 }
      );
    }

    // Update file record
    const newVersionNumber = currentVersionNumber + 1;

    const { error: updateError } = await supabase
      .from("files")
      .update({
        version: newVersionNumber,
        current_version_id: versionId,
        size_bytes: versionToRestore.size_bytes,
        checksum: versionToRestore.checksum,
        updated_at: new Date().toISOString(),
      })
      .eq("id", fileId);

    if (updateError) {
      console.error("[Restore Version] Update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update file record" },
        { status: 500 }
      );
    }

    // Log activity
    await supabase.from("file_activity").insert({
      file_id: fileId,
      user_id: user.id,
      action: "restore_version",
      details: {
        restored_version: versionToRestore.version_number,
        new_version: newVersionNumber,
        version_id: versionId,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({
      success: true,
      message: `Restored to version ${versionToRestore.version_number}`,
      newVersion: newVersionNumber,
      restoredVersion: versionToRestore.version_number,
    });
  } catch (error) {
    console.error("[Restore Version] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
