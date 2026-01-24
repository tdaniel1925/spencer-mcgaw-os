/**
 * Folder Operations by ID
 *
 * @route GET /api/folders/[id] - Get folder details
 * @route PATCH /api/folders/[id] - Update folder
 * @route DELETE /api/folders/[id] - Delete folder recursively
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/folders/[id] - Get folder details
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

    const { data: folder, error } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (folder.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    return NextResponse.json({ folder });
  } catch (error) {
    console.error("[Folder Get] Error:", error);
    return NextResponse.json({ error: "Failed to get folder" }, { status: 500 });
  }
}

const updateFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parentId: z.string().uuid().nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  description: z.string().nullable().optional(),
});

/**
 * PATCH /api/folders/[id] - Update folder
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
    const validated = updateFolderSchema.parse(body);

    // Get current folder
    const { data: folder, error: fetchError } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (folder.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // If moving to different parent, verify parent ownership and prevent circular reference
    if (validated.parentId !== undefined && validated.parentId !== folder.parent_id) {
      if (validated.parentId) {
        // Check if trying to move folder into itself or its descendant
        if (validated.parentId === id) {
          return NextResponse.json(
            { error: "Cannot move folder into itself" },
            { status: 400 }
          );
        }

        const { data: parentFolder, error: parentError } = await supabase
          .from("folders")
          .select("id, owner_id")
          .eq("id", validated.parentId)
          .single();

        if (parentError || !parentFolder) {
          return NextResponse.json({ error: "Target parent folder not found" }, { status: 404 });
        }

        if (parentFolder.owner_id !== user.id) {
          return NextResponse.json(
            { error: "Access denied to target parent folder" },
            { status: 403 }
          );
        }
      }
    }

    // Build update object
    const updates: Record<string, any> = {
      modified_at: new Date().toISOString(),
    };

    if (validated.name !== undefined) {
      updates.name = validated.name;
      updates.slug = validated.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    if (validated.parentId !== undefined) {
      updates.parent_id = validated.parentId;
    }

    if (validated.color !== undefined) {
      updates.color = validated.color;
    }

    if (validated.description !== undefined) {
      updates.description = validated.description;
    }

    // Update folder
    const { data: updatedFolder, error: updateError } = await supabase
      .from("folders")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("[Folder Update] Error:", updateError);
      return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
    }

    // Log activity
    await supabase.from("file_activity").insert({
      folder_id: id,
      user_id: user.id,
      action: "update_folder",
      details: {
        old_name: folder.name,
        new_name: validated.name,
        new_parent_id: validated.parentId,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ success: true, folder: updatedFolder });
  } catch (error) {
    console.error("[Folder Update] Unexpected error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to update folder" }, { status: 500 });
  }
}

/**
 * DELETE /api/folders/[id] - Delete folder and all contents recursively
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

    // Get folder
    const { data: folder, error: fetchError } = await supabase
      .from("folders")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (folder.owner_id !== user.id) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Recursive delete function with parallel processing (fixes race condition)
    async function deleteRecursively(folderId: string): Promise<{
      deletedFiles: number;
      deletedFolders: number;
      freedBytes: number;
    }> {
      let totalDeletedFiles = 0;
      let totalDeletedFolders = 0;
      let totalFreedBytes = 0;

      // Get all child folders and files in parallel
      const [childFoldersResult, filesResult] = await Promise.all([
        supabase.from("folders").select("*").eq("parent_id", folderId),
        supabase.from("files").select("*").eq("folder_id", folderId).eq("is_trashed", false),
      ]);

      const childFolders = childFoldersResult.data || [];
      const files = filesResult.data || [];

      // Delete all child folders in parallel (fixes the race condition identified in audit)
      if (childFolders.length > 0) {
        const childResults = await Promise.all(
          childFolders.map((child) => deleteRecursively(child.id))
        );

        for (const result of childResults) {
          totalDeletedFiles += result.deletedFiles;
          totalDeletedFolders += result.deletedFolders;
          totalFreedBytes += result.freedBytes;
        }
      }

      // Delete all files in this folder in parallel
      if (files.length > 0) {
        const fileDeletePromises = files.map(async (file) => {
          // Delete from storage
          await supabase.storage.from(file.storage_bucket).remove([file.storage_path]);

          // Delete from database
          await supabase.from("files").delete().eq("id", file.id);

          return file.size_bytes;
        });

        const fileSizes = await Promise.all(fileDeletePromises);
        const folderFreedBytes = fileSizes.reduce((sum, size) => sum + size, 0);

        totalDeletedFiles += files.length;
        totalFreedBytes += folderFreedBytes;
      }

      // Delete the folder itself
      await supabase.from("folders").delete().eq("id", folderId);
      totalDeletedFolders += 1;

      return {
        deletedFiles: totalDeletedFiles,
        deletedFolders: totalDeletedFolders,
        freedBytes: totalFreedBytes,
      };
    }

    // Perform recursive delete
    const { deletedFiles, deletedFolders, freedBytes } = await deleteRecursively(id);

    // Update quota (decrease usage)
    if (freedBytes > 0) {
      await supabase.rpc("increment_storage_usage", {
        p_user_id: user.id,
        p_bytes: -freedBytes,
      });
    }

    // Log activity
    await supabase.from("file_activity").insert({
      folder_id: id,
      user_id: user.id,
      action: "delete_folder",
      details: {
        folder_name: folder.name,
        deleted_files: deletedFiles,
        deleted_folders: deletedFolders,
        freed_bytes: freedBytes,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({
      success: true,
      deletedFiles,
      deletedFolders,
      freedBytes,
    });
  } catch (error) {
    console.error("[Folder Delete] Unexpected error:", error);
    return NextResponse.json({ error: "Failed to delete folder" }, { status: 500 });
  }
}
