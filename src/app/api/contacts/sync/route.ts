import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeIds, isValidId } from "@/lib/shared/validation";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

// Sync Microsoft contacts to the clients table
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
    const { contactIds } = body; // Optional: specific contacts to sync

    // Fetch contacts from Microsoft Graph
    let url = `${MICROSOFT_GRAPH_URL}/me/contacts?$top=500&$select=id,displayName,givenName,surname,emailAddresses,businessPhones,mobilePhone,companyName,jobTitle,businessAddress`;

    if (contactIds && Array.isArray(contactIds) && contactIds.length > 0) {
      // Sanitize IDs to prevent OData injection
      const sanitizedIds = sanitizeIds(contactIds);
      if (sanitizedIds.length > 0) {
        const filterIds = sanitizedIds.map((id: string) => `id eq '${id}'`).join(" or ");
        url += `&$filter=${filterIds}`;
      }
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch contacts from Microsoft" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const contacts = data.value || [];

    let synced = 0;
    let skipped = 0;
    let updated = 0;

    // Batch process contacts to avoid N+1 queries
    // First, get all emails from contacts
    const contactsWithEmail = contacts.filter((c: { emailAddresses?: { address: string }[] }) =>
      c.emailAddresses?.[0]?.address
    );
    const emails = contactsWithEmail.map((c: { emailAddresses: { address: string }[] }) =>
      c.emailAddresses[0].address.toLowerCase()
    );

    // Batch fetch existing clients by email
    const { data: existingClients } = await supabase
      .from("clients")
      .select("id, email, microsoft_contact_id")
      .in("email", emails);

    const existingClientMap = new Map(
      (existingClients || []).map(c => [c.email.toLowerCase(), c])
    );

    // Prepare batch operations
    const toInsert: Record<string, unknown>[] = [];
    const toUpdate: { id: string; data: Record<string, unknown> }[] = [];

    for (const contact of contacts) {
      const email = contact.emailAddresses?.[0]?.address;

      if (!email) {
        skipped++;
        continue;
      }

      const clientData = {
        first_name: contact.givenName || contact.displayName?.split(" ")[0] || "",
        last_name: contact.surname || contact.displayName?.split(" ").slice(1).join(" ") || "",
        email,
        phone: contact.mobilePhone || contact.businessPhones?.[0] || null,
        company_name: contact.companyName || null,
        microsoft_contact_id: contact.id,
        source: "microsoft_sync",
        updated_at: new Date().toISOString(),
      };

      const existing = existingClientMap.get(email.toLowerCase());
      if (existing) {
        toUpdate.push({ id: existing.id, data: clientData });
        updated++;
      } else {
        toInsert.push({
          ...clientData,
          status: "active",
          created_at: new Date().toISOString(),
        });
        synced++;
      }
    }

    // Batch insert new clients
    if (toInsert.length > 0) {
      await supabase.from("clients").insert(toInsert);
    }

    // Batch update existing clients (in smaller batches to avoid timeout)
    const BATCH_SIZE = 50;
    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
      const batch = toUpdate.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(({ id, data }) =>
          supabase.from("clients").update(data).eq("id", id)
        )
      );
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      type: "contacts_synced",
      description: `Synced contacts from Microsoft: ${synced} new, ${updated} updated, ${skipped} skipped`,
      metadata: {
        synced,
        updated,
        skipped,
        total: contacts.length,
      },
    });

    return NextResponse.json({
      success: true,
      synced,
      updated,
      skipped,
      total: contacts.length,
    });
  } catch (error) {
    console.error("Error syncing contacts:", error);
    return NextResponse.json(
      { error: "Failed to sync contacts" },
      { status: 500 }
    );
  }
}
