import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { passwordSchema } from "@/lib/validations/settings";
import { ZodError } from "zod";

// PUT - Change user's own password
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Validate request body with Zod
    const validatedData = passwordSchema.parse(body);
    const { currentPassword, newPassword } = validatedData;

    // Verify current password by attempting to sign in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email || "",
      password: currentPassword,
    });

    if (signInError) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error("Error updating password:", updateError);
      return NextResponse.json({ error: "Failed to update password" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Password updated successfully"
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }
    console.error("Error in password change:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
