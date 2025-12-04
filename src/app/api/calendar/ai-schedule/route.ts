import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import type { SchedulingRequest, TimeSlot, CalendarEvent } from "@/lib/calendar/types";

const MICROSOFT_GRAPH_URL = "https://graph.microsoft.com/v1.0";
const GOOGLE_CALENDAR_URL = "https://www.googleapis.com/calendar/v3";

// Initialize OpenAI client
function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  return new OpenAI({ apiKey });
}

interface BusySlot {
  start: Date;
  end: Date;
  source: string;
}

// Fetch busy times from Microsoft Calendar
async function getMicrosoftBusyTimes(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<BusySlot[]> {
  try {
    const response = await fetch(
      `${MICROSOFT_GRAPH_URL}/me/calendarView?startDateTime=${startDate.toISOString()}&endDateTime=${endDate.toISOString()}&$select=start,end,subject`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return (data.value || []).map((event: { start: { dateTime: string }; end: { dateTime: string } }) => ({
      start: new Date(event.start.dateTime),
      end: new Date(event.end.dateTime),
      source: "microsoft",
    }));
  } catch (error) {
    console.error("Error fetching Microsoft busy times:", error);
    return [];
  }
}

// Fetch busy times from Google Calendar
async function getGoogleBusyTimes(
  accessToken: string,
  startDate: Date,
  endDate: Date
): Promise<BusySlot[]> {
  try {
    const response = await fetch(
      `${GOOGLE_CALENDAR_URL}/calendars/primary/events?timeMin=${startDate.toISOString()}&timeMax=${endDate.toISOString()}&singleEvents=true`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!response.ok) return [];

    const data = await response.json();
    return (data.items || [])
      .filter((event: { start?: { dateTime?: string }; end?: { dateTime?: string } }) => event.start?.dateTime && event.end?.dateTime)
      .map((event: { start: { dateTime: string }; end: { dateTime: string } }) => ({
        start: new Date(event.start.dateTime),
        end: new Date(event.end.dateTime),
        source: "google",
      }));
  } catch (error) {
    console.error("Error fetching Google busy times:", error);
    return [];
  }
}

// Find available slots
function findAvailableSlots(
  busySlots: BusySlot[],
  startDate: Date,
  endDate: Date,
  duration: number, // minutes
  workingHours: { start: string; end: string },
  workingDays: number[]
): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const durationMs = duration * 60 * 1000;

  // Sort busy slots
  busySlots.sort((a, b) => a.start.getTime() - b.start.getTime());

  // Parse working hours
  const [workStartHour, workStartMin] = workingHours.start.split(":").map(Number);
  const [workEndHour, workEndMin] = workingHours.end.split(":").map(Number);

  // Iterate through each day
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();

    // Check if it's a working day
    if (workingDays.includes(dayOfWeek)) {
      // Set working hours for this day
      const dayStart = new Date(currentDate);
      dayStart.setHours(workStartHour, workStartMin, 0, 0);

      const dayEnd = new Date(currentDate);
      dayEnd.setHours(workEndHour, workEndMin, 0, 0);

      // Find busy slots for this day
      const dayBusy = busySlots.filter(
        (slot) =>
          slot.start < dayEnd && slot.end > dayStart
      );

      // Find gaps
      let slotStart = dayStart;

      for (const busy of dayBusy) {
        // If there's a gap before this busy slot
        if (slotStart < busy.start) {
          const gapEnd = new Date(Math.min(busy.start.getTime(), dayEnd.getTime()));
          const gapDuration = gapEnd.getTime() - slotStart.getTime();

          if (gapDuration >= durationMs) {
            // Can fit one or more slots
            let currentSlot = new Date(slotStart);
            while (currentSlot.getTime() + durationMs <= gapEnd.getTime()) {
              slots.push({
                start: new Date(currentSlot),
                end: new Date(currentSlot.getTime() + durationMs),
              });
              currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000); // 30 min increments
            }
          }
        }
        slotStart = new Date(Math.max(slotStart.getTime(), busy.end.getTime()));
      }

      // Check for remaining time after last busy slot
      if (slotStart < dayEnd) {
        const gapDuration = dayEnd.getTime() - slotStart.getTime();
        if (gapDuration >= durationMs) {
          let currentSlot = new Date(slotStart);
          while (currentSlot.getTime() + durationMs <= dayEnd.getTime()) {
            slots.push({
              start: new Date(currentSlot),
              end: new Date(currentSlot.getTime() + durationMs),
            });
            currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
          }
        }
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

// Use AI to score and rank slots
async function rankSlotsWithAI(
  slots: TimeSlot[],
  request: SchedulingRequest,
  existingEvents: BusySlot[]
): Promise<TimeSlot[]> {
  if (slots.length === 0) return [];

  try {
    const openai = getOpenAI();

    const prompt = `You are an intelligent scheduling assistant for a CPA/accounting firm.

Analyze these available time slots and score them from 0-1 based on:
1. Time of day preference (morning meetings often preferred for important clients)
2. Buffer time around other meetings
3. Day of week (avoid Mondays for complex meetings if possible)
4. Priority of the meeting
5. Any specific preferences mentioned

Meeting details:
- Title: ${request.title}
- Duration: ${request.duration} minutes
- Priority: ${request.priority || "medium"}
- Category: ${request.category || "other"}
- Notes: ${request.notes || "None"}
${request.preferredTimeRange ? `- Preferred time: ${request.preferredTimeRange.start} - ${request.preferredTimeRange.end}` : ""}
${request.preferredDays ? `- Preferred days: ${request.preferredDays.map(d => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}` : ""}

Available slots (first 20):
${slots.slice(0, 20).map((s, i) => `${i + 1}. ${s.start.toISOString()} - ${s.end.toISOString()}`).join("\n")}

Existing meetings nearby (for context):
${existingEvents.slice(0, 10).map((e) => `- ${e.start.toISOString()} to ${e.end.toISOString()}`).join("\n")}

Return a JSON array with the top 5 slots, each with:
- index (1-based from the list above)
- score (0-1)
- reason (short explanation)

Example: [{"index": 1, "score": 0.95, "reason": "Morning slot with good buffer time"}]

Return ONLY valid JSON array, no explanations.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 500,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a scheduling optimization assistant. Return only JSON." },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return slots.slice(0, 5);

    const parsed = JSON.parse(content);
    const rankings = Array.isArray(parsed) ? parsed : parsed.slots || [];

    // Apply scores to slots
    const rankedSlots: TimeSlot[] = rankings
      .filter((r: { index: number }) => r.index >= 1 && r.index <= slots.length)
      .map((r: { index: number; score: number; reason: string }) => ({
        ...slots[r.index - 1],
        score: r.score,
        reason: r.reason,
      }));

    return rankedSlots.length > 0 ? rankedSlots : slots.slice(0, 5);
  } catch (error) {
    console.error("AI ranking error:", error);
    // Return top 5 slots without AI ranking
    return slots.slice(0, 5).map((s) => ({ ...s, score: 0.5 }));
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body: SchedulingRequest = await request.json();
    const { duration, preferredDays, preferredTimeRange, deadline } = body;

    if (!duration) {
      return NextResponse.json(
        { error: "Duration is required" },
        { status: 400 }
      );
    }

    // Date range to search (next 14 days or until deadline)
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
    startDate.setDate(startDate.getDate() + 1); // Start tomorrow

    const endDate = deadline ? new Date(deadline) : new Date();
    if (!deadline) {
      endDate.setDate(endDate.getDate() + 14);
    }
    endDate.setHours(23, 59, 59, 999);

    // Get calendar connections
    const { data: connections } = await supabase
      .from("email_connections")
      .select("*")
      .eq("user_id", user.id);

    // Fetch busy times from all connected calendars
    let allBusySlots: BusySlot[] = [];

    for (const conn of connections || []) {
      if (conn.provider === "microsoft") {
        const msSlots = await getMicrosoftBusyTimes(
          conn.access_token,
          startDate,
          endDate
        );
        allBusySlots = [...allBusySlots, ...msSlots];
      }
    }

    // Check for Google calendar connection
    const { data: googleConn } = await supabase
      .from("calendar_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("provider", "google")
      .single();

    if (googleConn) {
      const googleSlots = await getGoogleBusyTimes(
        googleConn.access_token,
        startDate,
        endDate
      );
      allBusySlots = [...allBusySlots, ...googleSlots];
    }

    // Also fetch from local calendar events
    const { data: localEvents } = await supabase
      .from("calendar_events")
      .select("start_time, end_time")
      .gte("start_time", startDate.toISOString())
      .lte("end_time", endDate.toISOString());

    if (localEvents) {
      const localSlots = localEvents.map((e) => ({
        start: new Date(e.start_time),
        end: new Date(e.end_time),
        source: "local",
      }));
      allBusySlots = [...allBusySlots, ...localSlots];
    }

    // Default working hours
    const workingHours = preferredTimeRange || { start: "09:00", end: "17:00" };
    const workingDays = preferredDays || [1, 2, 3, 4, 5]; // Mon-Fri

    // Find available slots
    const availableSlots = findAvailableSlots(
      allBusySlots,
      startDate,
      endDate,
      duration,
      workingHours,
      workingDays
    );

    if (availableSlots.length === 0) {
      return NextResponse.json({
        success: true,
        slots: [],
        message: "No available slots found in the specified time range",
        recommendations: [
          "Try extending the date range",
          "Consider adjusting working hours",
          "Check if the duration can be shortened",
        ],
      });
    }

    // Use AI to rank and score slots
    const rankedSlots = await rankSlotsWithAI(availableSlots, body, allBusySlots);

    return NextResponse.json({
      success: true,
      slots: rankedSlots,
      totalAvailable: availableSlots.length,
      searchRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
      recommendations: [
        rankedSlots[0]?.reason || "Top slot selected based on availability",
        "AI analyzed your calendar patterns for optimal scheduling",
        `${availableSlots.length} total slots available in the next ${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))} days`,
      ],
    });
  } catch (error) {
    console.error("AI scheduling error:", error);
    return NextResponse.json(
      { error: "Failed to find available slots" },
      { status: 500 }
    );
  }
}
