/**
 * File Versions API
 *
 * @route GET /api/files/[id]/versions - List all versions of a file
 * @route POST /api/files/[id]/versions - Create new version (on file update)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/files/[id]/versions - List all versions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const fileId = params.id;

    // Get file to verify ownership
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

    // Get all versions
    const { data: versions, error: versionsError } = await supabase
      .from("file_versions")
      .select(`
        id,
        version_number,
        size_bytes,
        checksum,
        change_summary,
        created_at,
        created_by,
        users:created_by(full_name, email)
      `)
      .eq("file_id", fileId)
      .order("version_number", { ascending: false });

    if (versionsError) {
      console.error("[File Versions] List error:", versionsError);
      return NextResponse.json(
        { error: "Failed to list versions" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      versions: versions || [],
      fileName: file.name,
    });
  } catch (error) {
    console.error("[File Versions] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
