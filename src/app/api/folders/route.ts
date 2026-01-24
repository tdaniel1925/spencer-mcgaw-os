/**
 * Folders API
 *
 * @route POST /api/folders - Create folder
 * @route GET /api/folders - List folders
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const createFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().nullable().optional(),
  folderType: z
    .enum(["personal", "team", "shared", "repository", "client"])
    .default("personal"),
  color: z.string().max(50).nullable().optional(),
  description: z.string().nullable().optional(),
});

/**
 * POST /api/folders - Create new folder
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
    const validated = createFolderSchema.parse(body);

    // If parent folder specified, verify ownership
    if (validated.parentId) {
      const { data: parentFolder, error: parentError } = await supabase
        .from("folders")
        .select("id, owner_id")
        .eq("id", validated.parentId)
        .single();

      if (parentError || !parentFolder) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
      }

      if (parentFolder.owner_id !== user.id) {
        return NextResponse.json({ error: "Access denied to parent folder" }, { status: 403 });
      }
    }

    // Generate slug from name
    const slug = validated.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Create folder
    const { data: folder, error: createError } = await supabase
      .from("folders")
      .insert({
        name: validated.name,
        parent_id: validated.parentId || null,
        owner_id: user.id,
        folder_type: validated.folderType,
        slug,
        color: validated.color || null,
        description: validated.description || null,
      })
      .select()
      .single();

    if (createError) {
      console.error("[Folder Create] Error:", createError);
      return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
    }

    // Log activity
    await supabase.from("file_activity").insert({
      folder_id: folder.id,
      user_id: user.id,
      action: "create_folder",
      details: {
        folder_name: folder.name,
        parent_id: validated.parentId,
      },
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0] || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    return NextResponse.json({ success: true, folder });
  } catch (error) {
    console.error("[Folder Create] Unexpected error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to create folder" }, { status: 500 });
  }
}

const listFoldersSchema = z.object({
  parentId: z.string().uuid().nullable().optional(),
  type: z.enum(["personal", "team", "shared", "repository", "client"]).optional(),
  includeSubfolders: z.coerce.boolean().default(false),
});

/**
 * GET /api/folders - List folders
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

    const searchParams = request.nextUrl.searchParams;
    const params = listFoldersSchema.parse({
      parentId: searchParams.get("parentId") || undefined,
      type: searchParams.get("type") || undefined,
      includeSubfolders: searchParams.get("includeSubfolders") || "false",
    });

    // Build query
    let query = supabase.from("folders").select("*").eq("owner_id", user.id);

    if (!params.includeSubfolders) {
      // Get only direct children of parent
      if (params.parentId) {
        query = query.eq("parent_id", params.parentId);
      } else {
        query = query.is("parent_id", null);
      }
    } else if (params.parentId) {
      // Get all descendants (would need recursive CTE in production)
      query = query.eq("parent_id", params.parentId);
    }

    if (params.type) {
      query = query.eq("folder_type", params.type);
    }

    query = query.order("name", { ascending: true });

    const { data: folders, error } = await query;

    if (error) {
      console.error("[Folders List] Error:", error);
      return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
    }

    return NextResponse.json({ folders: folders || [] });
  } catch (error) {
    console.error("[Folders List] Unexpected error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request parameters", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
  }
}
