import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv"
];

// POST /api/chat/upload - Upload a file for chat
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const roomId = formData.get("room_id") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!roomId) {
      return NextResponse.json({ error: "room_id is required" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    // Verify user has access to this room
    const { data: room } = await supabase
      .from("chat_rooms")
      .select("type")
      .eq("id", roomId)
      .single();

    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }

    if (room.type !== "community") {
      const { data: membership } = await supabase
        .from("chat_room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .single();

      if (!membership) {
        return NextResponse.json({ error: "Not a member of this room" }, { status: 403 });
      }
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `chat/${roomId}/${timestamp}_${sanitizedName}`;

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        cacheControl: "3600"
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
    }

    // Get the public URL
    const { data: urlData } = supabase.storage
      .from("attachments")
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      name: file.name,
      type: file.type,
      size: file.size,
      path: filePath
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
}
