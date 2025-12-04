import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeODataFilter, validate } from "@/lib/shared/validation";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: connection, error: connError } = await supabase
    .from("email_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .single();

  if (connError || !connection) {
    return NextResponse.json(
      { error: "Microsoft account not connected" },
      { status: 400 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const topParam = searchParams.get("top") || "100";
    const search = searchParams.get("search");

    // Validate and sanitize inputs
    const top = Math.min(Math.max(1, parseInt(topParam, 10) || 100), 500);

    let url = `${MICROSOFT_GRAPH_URL}/me/contacts?$top=${top}&$select=id,displayName,givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle,businessAddress&$orderby=displayName`;

    if (search) {
      // Sanitize search input to prevent OData injection
      const sanitizedSearch = sanitizeODataFilter(search);
      if (sanitizedSearch) {
        url += `&$filter=contains(displayName,'${sanitizedSearch}') or contains(givenName,'${sanitizedSearch}') or contains(surname,'${sanitizedSearch}')`;
      }
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Graph API contacts error:", errorData);

      if (response.status === 401) {
        return NextResponse.json(
          { error: "Token expired. Please reconnect your Microsoft account." },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch contacts" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Transform contacts to a simpler format
    const contacts = (data.value || []).map((contact: Record<string, unknown>) => ({
      id: contact.id,
      displayName: contact.displayName,
      firstName: contact.givenName,
      lastName: contact.surname,
      email: (contact.emailAddresses as Array<{ address: string }>)?.[0]?.address || null,
      allEmails: (contact.emailAddresses as Array<{ address: string }>) || [],
      phone: contact.mobilePhone || (contact.businessPhones as string[])?.[0] || null,
      company: contact.companyName,
      jobTitle: contact.jobTitle,
      address: contact.businessAddress,
    }));

    return NextResponse.json({
      contacts,
      nextLink: data["@odata.nextLink"],
    });
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: connection, error: connError } = await supabase
    .from("email_connections")
    .select("*")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .single();

  if (connError || !connection) {
    return NextResponse.json(
      { error: "Microsoft account not connected" },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phone,
      company,
      jobTitle,
      address,
    } = body;

    // Validate input
    const validation = validate(body, {
      firstName: { type: "string", maxLength: 100 },
      lastName: { type: "string", maxLength: 100 },
      email: { type: "email" },
      phone: { type: "phone" },
      company: { type: "string", maxLength: 200 },
      jobTitle: { type: "string", maxLength: 100 },
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
        { status: 400 }
      );
    }

    if (!firstName && !lastName && !email) {
      return NextResponse.json(
        { error: "At least one of firstName, lastName, or email is required" },
        { status: 400 }
      );
    }

    // Build contact payload
    const contact: Record<string, unknown> = {};

    if (firstName) contact.givenName = firstName;
    if (lastName) contact.surname = lastName;
    if (email) {
      contact.emailAddresses = [{ address: email, name: `${firstName || ''} ${lastName || ''}`.trim() }];
    }
    if (phone) contact.mobilePhone = phone;
    if (company) contact.companyName = company;
    if (jobTitle) contact.jobTitle = jobTitle;
    if (address) {
      contact.businessAddress = {
        street: address.street,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        countryOrRegion: address.country,
      };
    }

    const response = await fetch(`${MICROSOFT_GRAPH_URL}/me/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(contact),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Graph API create contact error:", errorData);
      return NextResponse.json(
        { error: "Failed to create contact", details: errorData },
        { status: response.status }
      );
    }

    const createdContact = await response.json();

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      type: "contact_created",
      description: `Created contact: ${firstName || ''} ${lastName || ''}`.trim() || email,
      metadata: {
        contactId: createdContact.id,
        email,
      },
    });

    return NextResponse.json({
      success: true,
      contact: createdContact,
    });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
