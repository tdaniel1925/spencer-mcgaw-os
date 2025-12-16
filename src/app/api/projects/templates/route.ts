import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List project templates
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { data: templates, error } = await supabase
      .from("project_templates")
      .select(`
        *,
        tasks:project_template_tasks(count)
      `)
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    console.error("Error fetching project templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}
