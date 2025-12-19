import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET - List calendar events for the current user
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  try {
    let query = supabase
      .from("calendar_events")
      .select(`
        *,
        client:clients!client_id (id, name),
        contact:client_contacts!contact_id (id, first_name, last_name)
      `)
      .eq("user_id", user.id)
      .order("start_time", { ascending: true });

    // Filter by date range if provided
    if (startDate) {
      query = query.gte("start_time", startDate);
    }
    if (endDate) {
      query = query.lte("end_time", endDate);
    }

    const { data: events, error } = await query;

    if (error) {
      console.error("Error fetching calendar events:", error);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
    }

    // Transform to match CalendarEvent type expected by frontend
    const transformedEvents = (events || []).map(event => ({
      id: event.id,
      provider: event.provider || "local",
      externalId: event.external_id,
      title: event.title,
      description: event.description,
      location: event.location,
      startTime: event.start_time,
      endTime: event.end_time,
      allDay: event.all_day,
      timezone: event.timezone,
      isRecurring: event.is_recurring,
      recurrenceRule: event.recurrence_rule ? { frequency: event.recurrence_rule } : undefined,
      status: event.status,
      visibility: event.visibility,
      attendees: event.attendees || [],
      reminders: event.reminders || [],
      category: event.category,
      color: event.color,
      meetingLink: event.meeting_link,
      clientId: event.client_id,
      clientName: event.client?.name,
      contactId: event.contact_id,
      contactName: event.contact ? `${event.contact.first_name} ${event.contact.last_name}` : undefined,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    }));

    return NextResponse.json({ events: transformedEvents });
  } catch (error) {
    console.error("Error fetching calendar events:", error);
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 });
  }
}

// POST - Create a new calendar event
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();

    const { data: event, error } = await supabase
      .from("calendar_events")
      .insert({
        user_id: user.id,
        provider: body.provider || "local",
        title: body.title,
        description: body.description,
        location: body.location,
        meeting_link: body.meetingLink,
        start_time: body.startTime,
        end_time: body.endTime,
        all_day: body.allDay || false,
        timezone: body.timezone || "America/Chicago",
        is_recurring: body.isRecurring || false,
        recurrence_rule: body.recurrenceRule,
        category: body.category || "other",
        color: body.color,
        status: body.status || "confirmed",
        visibility: body.visibility || "default",
        attendees: body.attendees || [],
        reminders: body.reminders || [{ minutes: 30, method: "popup" }],
        client_id: body.clientId || null,
        contact_id: body.contactId || null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating event:", error);
      return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "created",
      resource_type: "calendar_event",
      resource_id: event.id,
      resource_name: event.title,
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Failed to create event" }, { status: 500 });
  }
}

// PUT - Update a calendar event
export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    // Convert camelCase to snake_case for database
    const dbUpdates: Record<string, unknown> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.meetingLink !== undefined) dbUpdates.meeting_link = updates.meetingLink;
    if (updates.startTime !== undefined) dbUpdates.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbUpdates.end_time = updates.endTime;
    if (updates.allDay !== undefined) dbUpdates.all_day = updates.allDay;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.attendees !== undefined) dbUpdates.attendees = updates.attendees;
    if (updates.reminders !== undefined) dbUpdates.reminders = updates.reminders;

    const { data: event, error } = await supabase
      .from("calendar_events")
      .update(dbUpdates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating event:", error);
      return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
  }
}

// DELETE - Delete a calendar event
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get("id");

    if (!eventId) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    // Get event details for activity log
    const { data: event } = await supabase
      .from("calendar_events")
      .select("title")
      .eq("id", eventId)
      .eq("user_id", user.id)
      .single();

    const { error } = await supabase
      .from("calendar_events")
      .delete()
      .eq("id", eventId)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting event:", error);
      return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
    }

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      user_email: user.email,
      action: "deleted",
      resource_type: "calendar_event",
      resource_id: eventId,
      resource_name: event?.title || "Unknown",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);
    return NextResponse.json({ error: "Failed to delete event" }, { status: 500 });
  }
}
