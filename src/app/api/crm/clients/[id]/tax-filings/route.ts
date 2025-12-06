import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List tax filings for a client
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const { searchParams } = new URL(request.url);
  const taxYear = searchParams.get("tax_year");
  const status = searchParams.get("status");

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    let query = supabase
      .from("client_tax_filings")
      .select("*")
      .eq("client_id", clientId);

    if (taxYear) {
      query = query.eq("tax_year", parseInt(taxYear));
    }

    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    const { data: filings, error } = await query
      .order("tax_year", { ascending: false })
      .order("filing_type", { ascending: true });

    if (error) throw error;

    // Get document requests for each filing
    const filingIds = filings?.map(f => f.id) || [];
    let documentsMap: Record<string, { received: number; total: number }> = {};

    if (filingIds.length > 0) {
      const { data: documents } = await supabase
        .from("client_document_requests")
        .select("tax_filing_id, status")
        .in("tax_filing_id", filingIds);

      documentsMap = (documents || []).reduce((acc, doc) => {
        if (!acc[doc.tax_filing_id]) {
          acc[doc.tax_filing_id] = { received: 0, total: 0 };
        }
        acc[doc.tax_filing_id].total++;
        if (doc.status === "received" || doc.status === "reviewed") {
          acc[doc.tax_filing_id].received++;
        }
        return acc;
      }, {} as Record<string, { received: number; total: number }>);
    }

    // Enrich filings with document progress
    const enrichedFilings = filings?.map(filing => ({
      ...filing,
      document_progress: documentsMap[filing.id] || { received: 0, total: 0 },
    }));

    return NextResponse.json({ filings: enrichedFilings });
  } catch (error) {
    console.error("Error fetching tax filings:", error);
    return NextResponse.json({ error: "Failed to fetch tax filings" }, { status: 500 });
  }
}

// POST - Create a new tax filing
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
      tax_year,
      filing_type,
      status,
      due_date,
      extended_due_date,
      preparer_id,
      reviewer_id,
      notes,
    } = body;

    const { data: filing, error } = await supabase
      .from("client_tax_filings")
      .insert({
        client_id: clientId,
        tax_year,
        filing_type,
        status: status || "not_started",
        due_date,
        extended_due_date,
        preparer_id,
        reviewer_id,
        notes,
      })
      .select()
      .single();

    if (error) throw error;

    // Also create a deadline for this filing
    if (due_date) {
      await supabase.from("client_deadlines").insert({
        client_id: clientId,
        deadline_type: "tax_filing",
        title: `${filing_type} - ${tax_year}`,
        description: `File ${filing_type} tax return for ${tax_year}`,
        due_date,
        assigned_to: preparer_id,
        tax_year,
        linked_filing_id: filing.id,
      });
    }

    return NextResponse.json({ filing }, { status: 201 });
  } catch (error) {
    console.error("Error creating tax filing:", error);
    return NextResponse.json({ error: "Failed to create tax filing" }, { status: 500 });
  }
}
