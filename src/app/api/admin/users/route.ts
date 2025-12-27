import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, validatePassword } from "@/lib/supabase/admin";
import { hasPermission, UserRole } from "@/lib/permissions";
import { emailWelcome } from "@/lib/email/email-service";

// GET - List all users for admin
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get current user's role to check permissions
  const { data: currentUserProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = currentUserProfile?.role as UserRole | undefined;

  // Check permission
  if (!hasPermission(userRole, "users:view")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
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
      full_name: u.full_name || u.email?.split("@")[0] || "Unknown",
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

// POST - Create new user with password
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get current user's role to check permissions
  const { data: currentUserProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = currentUserProfile?.role as UserRole | undefined;

  // Check permission
  if (!hasPermission(userRole, "users:create")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, full_name, password, role, department, job_title, phone, show_in_taskpool } = body;

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (!full_name) {
      return NextResponse.json({ error: "Full name is required" }, { status: 400 });
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return NextResponse.json({
        error: "Invalid password",
        details: passwordValidation.errors
      }, { status: 400 });
    }

    // Check role assignment permissions
    const requestedRole = role || "staff";

    // Only owners can create admins/owners
    if ((requestedRole === "owner" || requestedRole === "admin") && userRole !== "owner") {
      return NextResponse.json({
        error: "Only owners can assign admin or owner roles"
      }, { status: 403 });
    }

    // Only admins+ can assign manager role
    if (requestedRole === "manager" && userRole !== "owner" && userRole !== "admin") {
      return NextResponse.json({
        error: "Only admins can assign manager role"
      }, { status: 403 });
    }

    // Check if email already exists
    const { data: existingUser } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("email", email.toLowerCase())
      .single();

    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists" }, { status: 400 });
    }

    // Create user in Supabase Auth using admin client
    const adminClient = createAdminClient();

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: full_name,
      },
    });

    if (authError) {
      console.error("Error creating auth user:", authError);
      return NextResponse.json({
        error: authError.message || "Failed to create user account"
      }, { status: 500 });
    }

    if (!authData.user) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // Create/update user profile
    const { data: newProfile, error: profileError } = await supabase
      .from("user_profiles")
      .upsert({
        id: authData.user.id,
        email: email.toLowerCase(),
        full_name: full_name,
        role: requestedRole,
        department: department || null,
        job_title: job_title || null,
        phone: phone || null,
        show_in_taskpool: show_in_taskpool !== false,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (profileError) {
      console.error("Error creating user profile:", profileError);
      // Try to delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: "Failed to create user profile" }, { status: 500 });
    }

    // Send welcome email with the password
    try {
      const emailSent = await emailWelcome(email.toLowerCase(), full_name, password);
      if (!emailSent) {
        console.warn("Welcome email could not be sent (Resend may not be configured)");
      }
    } catch (emailError) {
      // Log but don't fail user creation if email fails
      console.error("Error sending welcome email:", emailError);
    }

    return NextResponse.json({
      user: newProfile,
      message: "User created successfully. They can now log in with their email and password.",
      emailSent: true
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
