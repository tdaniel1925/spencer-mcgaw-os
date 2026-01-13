import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApiUser, isAdmin } from "@/lib/auth/api-rbac";

// GET - List users for assignment dropdown
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || "";
  const taskpoolOnly = searchParams.get("taskpool") === "true";

  try {
    // Get users from user_profiles table
    let query = supabase
      .from("user_profiles")
      .select("id, email, full_name, avatar_url, show_in_taskpool")
      .order("full_name", { ascending: true });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    // Filter for taskpool ribbon users only
    if (taskpoolOnly) {
      query = query.eq("show_in_taskpool", true);
    }

    const { data: users, error } = await query.limit(20);

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// PATCH - Update user profile (admin only - for show_in_taskpool)
export async function PATCH(request: NextRequest) {
  // Require admin privileges to update other users
  const apiUser = await getApiUser();
  if (!apiUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!isAdmin(apiUser)) {
    return NextResponse.json({ error: "Admin privileges required" }, { status: 403 });
  }

  const supabase = await createClient();

  try {
    const body = await request.json();
    const { userId, show_in_taskpool } = body;

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Validate show_in_taskpool is a boolean
    if (typeof show_in_taskpool !== "boolean") {
      return NextResponse.json({ error: "show_in_taskpool must be a boolean" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .update({ show_in_taskpool, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .select()
      .single();

    if (error) {
      console.error("Error updating user profile:", error);
      return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}
