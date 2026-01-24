/**
 * Email Folders API - List all mail folders
 *
 * @route GET /api/emails/folders
 */

import { NextRequest, NextResponse } from "next/server";
import { GraphEmailService } from "@/lib/email/graph-service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const graphService = await GraphEmailService.fromConnection(user.id);
    if (!graphService) {
      return NextResponse.json(
        { error: "Email not connected", needsConnection: true },
        { status: 400 }
      );
    }

    const folders = await graphService.getFolders();

    // Add standard folder icons and organize
    const standardFolders = [
      { name: "inbox", displayName: "Inbox", icon: "inbox" },
      { name: "sent", displayName: "Sent", icon: "send" },
      { name: "drafts", displayName: "Drafts", icon: "file-text" },
      { name: "archive", displayName: "Archive", icon: "archive" },
      { name: "trash", displayName: "Trash", icon: "trash" },
      { name: "junk", displayName: "Junk", icon: "alert-triangle" },
    ];

    const organized = folders.map((folder) => {
      const standard = standardFolders.find(
        (sf) => folder.displayName.toLowerCase() === sf.displayName.toLowerCase()
      );

      return {
        id: folder.id,
        name: standard?.name || folder.displayName.toLowerCase().replace(/\s+/g, "_"),
        displayName: folder.displayName,
        icon: standard?.icon || "folder",
        unreadCount: folder.unreadItemCount,
        totalCount: folder.totalItemCount,
        childFolderCount: folder.childFolderCount,
      };
    });

    return NextResponse.json({ folders: organized });
  } catch (error) {
    console.error("[API] Error fetching folders:", error);
    return NextResponse.json({ error: "Failed to fetch folders" }, { status: 500 });
  }
}
