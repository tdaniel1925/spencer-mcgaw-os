import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List team members for task assignment (no admin permission required)
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Get active team members who can be assigned tasks
    const { data: users, error } = await supabase
      .from("user_profiles")
      .select("id, email, full_name, role, department, job_title, avatar_url")
      .eq("is_active", true)
      .eq("show_in_taskpool", true)
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error fetching team members:", error);
      return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
    }

    // Transform data for frontend
    const transformedUsers = (users || []).map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name || u.email?.split("@")[0] || "Unknown",
      role: u.role || "staff",
      department: u.department || "",
      job_title: u.job_title || "",
      avatar_url: u.avatar_url,
    }));

    return NextResponse.json({ users: transformedUsers });
  } catch (error) {
    console.error("Error fetching team members:", error);
    return NextResponse.json({ error: "Failed to fetch team members" }, { status: 500 });
  }
}
