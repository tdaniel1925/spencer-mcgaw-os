import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST - Update last login timestamp for current user
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("user_profiles")
      .update({
        last_login: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("Error updating last login:", error);
      return NextResponse.json({ error: "Failed to update last login" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating last login:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
