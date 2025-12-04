import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get email connection (which now includes calendar permissions)
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
    const startDateTime = searchParams.get("startDateTime") || new Date().toISOString();
    const endDateTime = searchParams.get("endDateTime") || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const top = searchParams.get("top") || "50";

    // Fetch calendar events from Microsoft Graph
    const response = await fetch(
      `${MICROSOFT_GRAPH_URL}/me/calendarView?startDateTime=${startDateTime}&endDateTime=${endDateTime}&$top=${top}&$orderby=start/dateTime&$select=id,subject,start,end,location,bodyPreview,isAllDay,organizer,attendees,webLink`,
      {
        headers: {
          Authorization: `Bearer ${connection.access_token}`,
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Graph API calendar error:", errorData);

      if (response.status === 401) {
        return NextResponse.json(
          { error: "Token expired. Please reconnect your Microsoft account." },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch calendar events" },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      events: data.value || [],
      nextLink: data["@odata.nextLink"],
    });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
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
      subject,
      start,
      end,
      location,
      body: eventBody,
      attendees,
      isAllDay = false,
      reminderMinutesBeforeStart = 15,
    } = body;

    if (!subject || !start || !end) {
      return NextResponse.json(
        { error: "Missing required fields: subject, start, end" },
        { status: 400 }
      );
    }

    // Build the event payload
    const event: Record<string, unknown> = {
      subject,
      start: {
        dateTime: start,
        timeZone: "UTC",
      },
      end: {
        dateTime: end,
        timeZone: "UTC",
      },
      isAllDay,
      reminderMinutesBeforeStart,
    };

    if (location) {
      event.location = { displayName: location };
    }

    if (eventBody) {
      event.body = {
        contentType: "HTML",
        content: eventBody,
      };
    }

    if (attendees && attendees.length > 0) {
      event.attendees = attendees.map((email: string) => ({
        emailAddress: { address: email },
        type: "required",
      }));
    }

    // Create event via Microsoft Graph
    const response = await fetch(`${MICROSOFT_GRAPH_URL}/me/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Graph API create event error:", errorData);
      return NextResponse.json(
        { error: "Failed to create event", details: errorData },
        { status: response.status }
      );
    }

    const createdEvent = await response.json();

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      type: "calendar_event_created",
      description: `Created calendar event: ${subject}`,
      metadata: {
        eventId: createdEvent.id,
        subject,
        start,
        end,
      },
    });

    return NextResponse.json({
      success: true,
      event: createdEvent,
    });
  } catch (error) {
    console.error("Error creating calendar event:", error);
    return NextResponse.json(
      { error: "Failed to create calendar event" },
      { status: 500 }
    );
  }
}
