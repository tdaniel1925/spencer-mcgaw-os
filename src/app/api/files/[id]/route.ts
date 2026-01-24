/**
 * File Operations by ID
 *
 * @route GET /api/files/[id] - Get file metadata
 * @route PATCH /api/files/[id] - Update file (rename, move, star)
 * @route DELETE /api/files/[id] - Delete file (move to trash)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/files/[id] - Get file metadata
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

    const { data: file, error } = await supabase
      .from("files")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Check ownership
    if (file.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ file });
  } catch (error) {
    console.error("[File Get] Error:", error);
    return NextResponse.json({ error: "Failed to get file" }, { status: 500 });
  }
}

const updateFileSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  folderId: z.string().uuid().nullable().optional(),
  isStarred: z.boolean().optional(),
});

/**
 * PATCH /api/files/[id] - Update file metadata
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const validated = updateFileSchema.parse(body);

    // Get current file
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

    // If moving to different folder, verify folder ownership
    if (validated.folderId !== undefined && validated.folderId !== file.folder_id) {
      if (validated.folderId) {
        const { data: folder, error: folderError } = await supabase
          .from("folders")
          .select("id, owner_id")
          .eq("id", validated.folderId)
          .single();

        if (folderError || !folder) {
          return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
        }

        if (folder.owner_id !== user.id) {
          return NextResponse.json({ error: "Access denied to target folder" }, { status: 403 });
        }
      }
    }

    // Build update object
    const updates: Record<string, any> = {
      modified_at: new Date().toISOString(),
    };

    if (validated.name !== undefined) {
      // Sanitize name
      const sanitizedName = validated.name
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/^\.+/, "_")
        .replace(/\.{2,}/g, "_")
        .substring(0, 255);
      updates.name = sanitizedName;
    }

    if (validated.folderId !== undefined) {
      updates.folder_id = validated.folderId;
    }

    if (validated.isStarred !== undefined) {
      updates.is_starred = validated.isStarred;
    }

    // Update file
    const { data: updatedFile, error: updateError } = await supabase
      .from("files")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[File Update] Error:", updateError);
      return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
    }

    // Log activity
    const actionDetails: Record<string, any> = {};
    if (validated.name) actionDetails.new_name = validated.name;
    if (validated.folderId !== undefined) actionDetails.new_folder_id = validated.folderId;
    if (validated.isStarred !== undefined) actionDetails.is_starred = validated.isStarred;

    await supabase.from("file_activity").insert({
      file_id: id,
      folder_id: file.folder_id,
      user_id: user.id,
      action: validated.name ? "rename" : validated.folderId !== undefined ? "move" : "update",
      details: actionDetails,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ success: true, file: updatedFile });
  } catch (error) {
    console.error("[File Update] Unexpected error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to update file" }, { status: 500 });
  }
}

/**
 * DELETE /api/files/[id] - Move file to trash (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const permanent = searchParams.get("permanent") === "true";

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

    if (permanent) {
      // Permanent delete - remove from storage and database
      await supabase.storage.from(file.storage_bucket).remove([file.storage_path]);

      const { error: deleteError } = await supabase.from("files").delete().eq("id", id);

      if (deleteError) {
        console.error("[File Delete] Error:", deleteError);
        return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
      }

      // Update quota (decrease usage)
      await supabase.rpc("increment_storage_usage", {
        p_user_id: user.id,
        p_bytes: -file.size_bytes,
      });

      // Log activity
      await supabase.from("file_activity").insert({
        file_id: id,
        folder_id: file.folder_id,
        user_id: user.id,
        action: "delete_permanent",
        details: {
          file_name: file.name,
          size_bytes: file.size_bytes,
        },
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
        user_agent: request.headers.get("user-agent") || null,
      });

      return NextResponse.json({ success: true, permanent: true });
    } else {
      // Soft delete - move to trash
      const { data: trashedFile, error: trashError } = await supabase
        .from("files")
        .update({
          is_trashed: true,
          trashed_at: new Date().toISOString(),
          modified_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (trashError) {
        console.error("[File Trash] Error:", trashError);
        return NextResponse.json({ error: "Failed to move file to trash" }, { status: 500 });
      }

      // Log activity
      await supabase.from("file_activity").insert({
        file_id: id,
        folder_id: file.folder_id,
        user_id: user.id,
        action: "trash",
        details: {
          file_name: file.name,
        },
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
        user_agent: request.headers.get("user-agent") || null,
      });

      return NextResponse.json({ success: true, file: trashedFile });
    }
  } catch (error) {
    console.error("[File Delete] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to delete file" }, { status: 500 });
  }
}
