import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List all templates
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");
  const activeOnly = searchParams.get("active_only") !== "false";

  try {
    let query = supabase
      .from("sms_templates")
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true);
    }

    if (category) {
      query = query.eq("category", category);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error("Error fetching templates:", error);
      return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
    }

    // Group by category
    const grouped = templates?.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {} as Record<string, typeof templates>);

    return NextResponse.json({ templates, grouped });
  } catch (error) {
    console.error("Error fetching templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

// POST - Create new template
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, category, body: templateBody, variables } = body;

    if (!name || !category || !templateBody) {
      return NextResponse.json({ error: "name, category, and body are required" }, { status: 400 });
    }

    // Extract variables from template body (e.g., {{first_name}})
    const extractedVars = templateBody.match(/\{\{(\w+)\}\}/g)?.map((v: string) => v.replace(/\{\{|\}\}/g, "")) || [];
    const finalVariables = variables || extractedVars;

    const { data: template, error } = await supabase
      .from("sms_templates")
      .insert({
        name,
        category,
        body: templateBody,
        variables: finalVariables,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating template:", error);
      return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
    }

    return NextResponse.json(template);
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
