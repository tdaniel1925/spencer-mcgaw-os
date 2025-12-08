import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - Get user profile settings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: profile, error } = await supabase
      .from("users")
      .select("full_name, email, phone, department, job_title, avatar_url, bio")
      .eq("id", user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    return NextResponse.json({
      fullName: profile?.full_name || "",
      email: profile?.email || user.email || "",
      phone: profile?.phone || "",
      department: profile?.department || "",
      jobTitle: profile?.job_title || "",
      avatarUrl: profile?.avatar_url || "",
      bio: profile?.bio || "",
    });
  } catch (error) {
    console.error("Error in profile GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update user profile
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { fullName, phone, department, jobTitle, bio } = body;

    const { error } = await supabase
      .from("users")
      .update({
        full_name: fullName,
        phone,
        department,
        job_title: jobTitle,
        bio,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating profile:", error);
      return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Profile updated successfully" });
  } catch (error) {
    console.error("Error in profile PUT:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
