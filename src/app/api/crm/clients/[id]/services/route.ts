import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List services for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const taxYear = searchParams.get("tax_year");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    let query = supabase
      .from("client_services")
      .select("*")
      .eq("client_id", clientId);

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (taxYear) {
      query = query.eq("tax_year", parseInt(taxYear));
    }

    const { data: services, error } = await query
      .order("status", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ services });
  } catch (error) {
    console.error("Error fetching services:", error);
    return NextResponse.json({ error: "Failed to fetch services" }, { status: 500 });
  }
}

// POST - Create a new service
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      service_type,
      service_name,
      description,
      frequency,
      status,
      start_date,
      end_date,
      fee_type,
      fee_amount,
      assigned_to,
      tax_year,
      notes,
    } = body;

    const { data: service, error } = await supabase
      .from("client_services")
      .insert({
        client_id: clientId,
        service_type,
        service_name,
        description,
        frequency: frequency || "one_time",
        status: status || "active",
        start_date,
        end_date,
        fee_type: fee_type || "fixed",
        fee_amount,
        assigned_to,
        tax_year,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ service }, { status: 201 });
  } catch (error) {
    console.error("Error creating service:", error);
    return NextResponse.json({ error: "Failed to create service" }, { status: 500 });
  }
}
