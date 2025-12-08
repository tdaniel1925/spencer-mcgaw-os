"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarDays,
  Clock,
  Video,
  MapPin,
  ChevronRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isBefore, addHours, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { useDashboard, UserCalendar } from "@/lib/dashboard";
import type { CalendarEvent } from "@/lib/calendar/types";

// Demo events - in production these would come from an API
const generateDemoEvents = (calendars: UserCalendar[]): CalendarEvent[] => {
  const now = new Date();
  const today = startOfDay(now);

  const enabledCalendars = calendars.filter(c => c.enabled);
  if (enabledCalendars.length === 0) return [];

  const events: CalendarEvent[] = [
    {
      id: "1",
      provider: "local",
      title: "Team Standup",
      startTime: addHours(today, 9),
      endTime: addHours(today, 9.5),
      allDay: false,
      status: "confirmed",
      visibility: "default",
      attendees: [],
      reminders: [],
      isRecurring: true,
      category: "internal_meeting",
      color: enabledCalendars.find(c => c.name === "Work")?.color || enabledCalendars[0]?.color,
      createdAt: new Date(),
      updatedAt: new Date(),
      meetingLink: "https://meet.google.com/abc-defg-hij",
    },
    {
      id: "2",
      provider: "local",
      title: "Client Call - Johnson Tax Review",
      description: "Review Q4 tax documents",
      startTime: addHours(today, 10),
      endTime: addHours(today, 11),
      allDay: false,
      status: "confirmed",
      visibility: "default",
      attendees: [{ email: "sarah@example.com", name: "Sarah Johnson", status: "accepted" }],
      reminders: [{ method: "popup", minutes: 15 }],
      isRecurring: false,
      category: "client_meeting",
      clientName: "Sarah Johnson",
      color: enabledCalendars.find(c => c.name === "Client Meetings")?.color || "#f97316",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
      provider: "local",
      title: "Document Review",
      startTime: addHours(today, 14),
      endTime: addHours(today, 15),
      allDay: false,
      status: "confirmed",
      visibility: "default",
      attendees: [],
      reminders: [],
      isRecurring: false,
      category: "document_review",
      color: enabledCalendars.find(c => c.name === "Work")?.color || "#3b82f6",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "4",
      provider: "local",
      title: "Tax Filing Deadline",
      startTime: addHours(today, 17),
      endTime: addHours(today, 17),
      allDay: false,
      status: "confirmed",
      visibility: "default",
      attendees: [],
      reminders: [],
      isRecurring: false,
      category: "deadline",
      color: "#ef4444",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  return events;
};

interface CompactAgendaProps {
  maxItems?: number;
}

export function CompactAgenda({ maxItems = 4 }: CompactAgendaProps) {
  const router = useRouter();
  const { calendars } = useDashboard();

  const allEvents = useMemo(() => generateDemoEvents(calendars), [calendars]);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    return allEvents
      .filter((event) => {
        const eventInRange = isWithinInterval(event.startTime, { start: dayStart, end: dayEnd });
        const matchingCalendar = calendars.find(c => c.color === event.color);
        const calendarEnabled = !matchingCalendar || matchingCalendar.enabled;
        const notPast = !isBefore(event.endTime, now);
        return eventInRange && calendarEnabled && notPast;
      })
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
      .slice(0, maxItems);
  }, [allEvents, calendars, maxItems]);

  const now = new Date();
  const currentEvent = upcomingEvents.find(
    (event) => isBefore(event.startTime, now) && !isBefore(event.endTime, now)
  );

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Today&apos;s Agenda
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {upcomingEvents.length} events
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          {format(now, "EEEE, MMMM d")}
        </p>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <div className="flex-1 px-4 py-2 space-y-2 overflow-hidden">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => {
              const isActive = event.id === currentEvent?.id;

              return (
                <div
                  key={event.id}
                  onClick={() => router.push("/calendar")}
                  className={cn(
                    "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all",
                    "hover:bg-muted/50",
                    isActive && "bg-primary/10 ring-1 ring-primary/30"
                  )}
                >
                  {/* Color indicator */}
                  <div
                    className="w-1 h-10 rounded-full flex-shrink-0"
                    style={{ backgroundColor: event.color || "#3b82f6" }}
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                      )}
                      <p className="font-medium text-sm truncate">{event.title}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span suppressHydrationWarning>
                        {format(event.startTime, "h:mm a")}
                      </span>
                      {event.meetingLink && (
                        <Video className="h-3 w-3 text-blue-500" />
                      )}
                      {event.location && (
                        <>
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{event.location}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No events today</p>
            </div>
          )}
        </div>

        {/* Fixed footer */}
        <div className="flex-shrink-0 p-3 border-t mt-auto">
          <Button
            variant="ghost"
            className="w-full justify-between h-8 text-sm"
            onClick={() => router.push("/calendar")}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-3 w-3" />
              Add Event
            </span>
            <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
