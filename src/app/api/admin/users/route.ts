import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all users for admin
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: users, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("full_name", { ascending: true });

    if (error) {
      console.error("Error fetching users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    // Transform data for frontend
    const transformedUsers = (users || []).map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.full_name || u.email.split("@")[0],
      role: u.role || "staff",
      department: u.department || "",
      job_title: u.job_title || "",
      phone: u.phone || "",
      avatar_url: u.avatar_url,
      is_active: u.is_active !== false,
      show_in_taskpool: u.show_in_taskpool !== false,
      last_login: u.last_login,
      created_at: u.created_at,
    }));

    return NextResponse.json({ users: transformedUsers });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST - Create new user (for invites)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { email, full_name, role, department, job_title, phone, show_in_taskpool } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // For now, we'll create a user profile entry
    // In production, this would trigger an invite flow through Supabase Auth
    const { data: newUser, error } = await supabase
      .from("user_profiles")
      .insert({
        id: crypto.randomUUID(), // Temporary ID until they sign up
        email,
        full_name: full_name || email.split("@")[0],
        role: role || "staff",
        department,
        job_title,
        phone,
        show_in_taskpool: show_in_taskpool !== false,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating user:", error);
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    return NextResponse.json({ user: newUser });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
