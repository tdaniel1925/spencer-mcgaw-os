"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CalendarDays,
  Clock,
  MapPin,
  Video,
  ExternalLink,
  ChevronRight,
  Settings,
  Plus,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isBefore, addHours, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { useDashboard, UserCalendar, calendarColors } from "@/lib/dashboard";
import type { CalendarEvent, EventCategory } from "@/lib/calendar/types";
import { categoryInfo } from "@/lib/calendar/types";

// Demo events for display - in production these would come from an API
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
      description: "Review Q4 tax documents with Sarah Johnson",
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
      color: enabledCalendars.find(c => c.name === "Client Meetings")?.color || enabledCalendars[0]?.color,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "3",
      provider: "local",
      title: "Lunch Break",
      startTime: addHours(today, 12),
      endTime: addHours(today, 13),
      allDay: false,
      status: "confirmed",
      visibility: "private",
      attendees: [],
      reminders: [],
      isRecurring: true,
      category: "personal",
      color: enabledCalendars.find(c => c.name === "Personal")?.color || "#22c55e",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "4",
      provider: "local",
      title: "Tax Filing Deadline - Smith Corp",
      startTime: addHours(today, 17),
      endTime: addHours(today, 17),
      allDay: false,
      status: "confirmed",
      visibility: "default",
      attendees: [],
      reminders: [{ method: "email", minutes: 60 }],
      isRecurring: false,
      category: "deadline",
      color: enabledCalendars.find(c => c.name === "Deadlines")?.color || "#ef4444",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "5",
      provider: "local",
      title: "Document Review",
      description: "Review quarterly statements",
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
  ];

  return events;
};

interface CalendarWidgetProps {
  className?: string;
  size?: "small" | "medium" | "large";
}

function CalendarWidgetBase({ className, size = "medium" }: CalendarWidgetProps) {
  const router = useRouter();
  const { calendars, toggleCalendar, calendarSettings } = useDashboard();
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);

  // Generate events based on enabled calendars
  const allEvents = useMemo(() => generateDemoEvents(calendars), [calendars]);

  // Filter events for today and by enabled calendars
  const todaysEvents = useMemo(() => {
    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    return allEvents
      .filter((event) => {
        // Check if event is today
        const eventInRange = isWithinInterval(event.startTime, { start: dayStart, end: dayEnd });

        // Check if calendar for this event is enabled
        const matchingCalendar = calendars.find(c => c.color === event.color);
        const calendarEnabled = !matchingCalendar || matchingCalendar.enabled;

        return eventInRange && calendarEnabled;
      })
      .sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [allEvents, calendars]);

  // Upcoming events (next few hours)
  const now = new Date();
  const upcomingEvents = todaysEvents.filter(
    (event) => !isBefore(event.endTime, now)
  );

  // Current/ongoing event
  const currentEvent = upcomingEvents.find(
    (event) =>
      isBefore(event.startTime, now) && !isBefore(event.endTime, now)
  );

  // Get enabled calendar count
  const enabledCount = calendars.filter(c => c.enabled).length;

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Today&apos;s Agenda
          </CardTitle>
          <div className="flex items-center gap-1">
            {/* Calendar Toggle Popover */}
            <Popover open={showCalendarPicker} onOpenChange={setShowCalendarPicker}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 px-2">
                  <div className="flex items-center gap-1">
                    {calendars.slice(0, 4).map((cal) => (
                      <div
                        key={cal.id}
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition-opacity",
                          !cal.enabled && "opacity-30"
                        )}
                        style={{ backgroundColor: cal.color }}
                      />
                    ))}
                    {calendars.length > 4 && (
                      <span className="text-xs text-muted-foreground">+{calendars.length - 4}</span>
                    )}
                  </div>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-3" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium">Calendars</h4>
                    <span className="text-xs text-muted-foreground">
                      {enabledCount} of {calendars.length} shown
                    </span>
                  </div>
                  <div className="space-y-2">
                    {calendars.map((calendar) => (
                      <div
                        key={calendar.id}
                        className="flex items-center gap-2 cursor-pointer group"
                        onClick={() => toggleCalendar(calendar.id)}
                      >
                        <Checkbox
                          checked={calendar.enabled}
                          onCheckedChange={() => toggleCalendar(calendar.id)}
                          className="data-[state=checked]:border-transparent"
                          style={{
                            backgroundColor: calendar.enabled ? calendar.color : undefined,
                            borderColor: calendar.color,
                          }}
                        />
                        <span
                          className={cn(
                            "text-sm flex-1",
                            !calendar.enabled && "text-muted-foreground"
                          )}
                        >
                          {calendar.name}
                        </span>
                        {calendar.enabled ? (
                          <Eye className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        ) : (
                          <EyeOff className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => router.push("/calendar")}
                    >
                      <Settings className="h-3 w-3 mr-2" />
                      Manage calendars
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            <Badge variant="secondary" className="text-xs">
              {upcomingEvents.length} events
            </Badge>
          </div>
        </div>
        <p className="text-xs text-muted-foreground" suppressHydrationWarning>
          {format(now, "EEEE, MMMM d")}
        </p>
      </CardHeader>

      <CardContent className="p-0">
        <ScrollArea className={cn(
          size === "small" && "h-[200px]",
          size === "medium" && "h-[320px]",
          size === "large" && "h-[450px]"
        )}>
          <div className="p-4 space-y-3">
            {/* Current Event Highlight */}
            {currentEvent && (
              <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  NOW
                </p>
                <EventCard event={currentEvent} isActive />
              </div>
            )}

            {/* Upcoming Events */}
            {upcomingEvents.length > 0 ? (
              <div className="space-y-2">
                {!currentEvent && (
                  <p className="text-xs text-muted-foreground mb-2">UPCOMING</p>
                )}
                {upcomingEvents
                  .filter((e) => e.id !== currentEvent?.id)
                  .map((event) => (
                    <EventCard key={event.id} event={event} />
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium">No events today</p>
                <p className="text-xs mt-1">
                  {enabledCount === 0
                    ? "Enable a calendar to see events"
                    : "Enjoy your free day!"}
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <Button
            variant="ghost"
            className="w-full justify-between"
            size="sm"
            onClick={() => router.push("/calendar")}
          >
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Event
            </span>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// Event Card Component
function EventCard({
  event,
  isActive = false,
}: {
  event: CalendarEvent;
  isActive?: boolean;
}) {
  const router = useRouter();
  const category = categoryInfo[event.category || "other"];
  const isPast = isBefore(event.endTime, new Date());

  return (
    <div
      onClick={() => router.push("/calendar")}
      className={cn(
        "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
        isActive && "ring-2 ring-primary/50 bg-primary/5",
        isPast && "opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Color indicator */}
        <div
          className="w-1 self-stretch rounded-full flex-shrink-0"
          style={{ backgroundColor: event.color || category.color.replace("bg-", "#") }}
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <p className={cn("font-medium text-sm truncate", isPast && "line-through")}>
            {event.title}
          </p>

          {/* Time */}
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span suppressHydrationWarning>
              {event.allDay
                ? "All day"
                : `${format(event.startTime, "h:mm a")} - ${format(event.endTime, "h:mm a")}`}
            </span>
          </div>

          {/* Location or Meeting Link */}
          {(event.location || event.meetingLink) && (
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              {event.meetingLink ? (
                <>
                  <Video className="h-3 w-3 text-blue-500" />
                  <span className="text-blue-500">Video call</span>
                </>
              ) : (
                <>
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{event.location}</span>
                </>
              )}
            </div>
          )}

          {/* Client name */}
          {event.clientName && (
            <Badge variant="secondary" className="mt-2 text-xs">
              {event.clientName}
            </Badge>
          )}
        </div>

        {/* Category badge */}
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
              )}
              style={{ backgroundColor: event.color || category.color.replace("bg-", "#") }}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>{category.label}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

// Export with error boundary wrapping
export function CalendarWidget(props: CalendarWidgetProps) {
  return (
    <ErrorBoundary name="Calendar Widget" compact>
      <CalendarWidgetBase {...props} />
    </ErrorBoundary>
  );
}
