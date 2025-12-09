import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_ORGANIZATION_ID, DEFAULT_COMPANY_NAME } from "@/lib/constants";

// GET - Get company/organization settings
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Try to get existing settings
    const { data: settings, error } = await supabase
      .from("organization_settings")
      .select("*")
      .eq("id", DEFAULT_ORGANIZATION_ID)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = not found, which is ok
      console.error("Error fetching company settings:", error);
    }

    // Return settings or defaults
    return NextResponse.json({
      companyName: settings?.company_name || DEFAULT_COMPANY_NAME,
      companyEmail: settings?.company_email || "",
      companyPhone: settings?.company_phone || "",
      timezone: settings?.timezone || "cst",
      address: settings?.address || "",
      website: settings?.website || "",
      taxId: settings?.tax_id || "",
    });
  } catch (error) {
    console.error("Error in company settings GET:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT - Update company/organization settings
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check if user is admin
  const { data: userProfile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only admins can update company settings" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { companyName, companyEmail, companyPhone, timezone, address, website, taxId } = body;

    // Upsert settings (insert if not exists, update if exists)
    const { error } = await supabase
      .from("organization_settings")
      .upsert({
        id: DEFAULT_ORGANIZATION_ID,
        company_name: companyName,
        company_email: companyEmail,
        company_phone: companyPhone,
        timezone,
        address,
        website,
        tax_id: taxId,
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      });

    if (error) {
      console.error("Error updating company settings:", error);
      return NextResponse.json({ error: "Failed to update company settings" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Company settings updated successfully" });
  } catch (error) {
    console.error("Error in company settings PUT:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
