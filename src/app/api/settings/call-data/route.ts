import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { calls } from "@/db/schema";
import { sql } from "drizzle-orm";

/**
 * GET /api/settings/call-data
 * Returns call data settings and current call count
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    // Get current call count
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(calls);
    const callCount = Number(countResult[0]?.count || 0);

    // Get settings from org_settings table
    const { data: settings } = await supabase
      .from("org_settings")
      .select("call_auto_delete_enabled, call_delete_after_days, call_delete_on_day")
      .single();

    return NextResponse.json({
      autoDeleteEnabled: settings?.call_auto_delete_enabled || false,
      deleteAfterDays: settings?.call_delete_after_days || 30,
      deleteOnDay: settings?.call_delete_on_day || "",
      callCount,
    });
  } catch (error) {
    console.error("[Call Data Settings] Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch call data settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/call-data
 * Updates call auto-delete settings
 */
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { autoDeleteEnabled, deleteAfterDays, deleteOnDay } = body;

    // Validate deleteAfterDays
    const days = parseInt(deleteAfterDays) || 30;
    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: "Delete after days must be between 1 and 365" },
        { status: 400 }
      );
    }

    // Validate deleteOnDay
    const validDays = ["", "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    if (!validDays.includes(deleteOnDay || "")) {
      return NextResponse.json(
        { error: "Invalid day of week" },
        { status: 400 }
      );
    }

    // Update or insert settings
    const { error } = await supabase
      .from("org_settings")
      .upsert({
        id: 1, // Single row for org settings
        call_auto_delete_enabled: autoDeleteEnabled === true,
        call_delete_after_days: days,
        call_delete_on_day: deleteOnDay || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "id",
      });

    if (error) {
      console.error("[Call Data Settings] Error saving settings:", error);
      return NextResponse.json(
        { error: "Failed to save call data settings" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      autoDeleteEnabled: autoDeleteEnabled === true,
      deleteAfterDays: days,
      deleteOnDay: deleteOnDay || "",
    });
  } catch (error) {
    console.error("[Call Data Settings] Error:", error);
    return NextResponse.json(
      { error: "Failed to save call data settings" },
      { status: 500 }
    );
  }
}
