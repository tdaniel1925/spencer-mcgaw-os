"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  addDays,
} from "date-fns";

// Mock calendar events
const mockEvents = [
  {
    id: "1",
    title: "Client Meeting - John Smith",
    description: "Annual tax review meeting",
    startTime: new Date(2025, 0, 3, 10, 0),
    endTime: new Date(2025, 0, 3, 11, 0),
    color: "bg-primary",
    allDay: false,
  },
  {
    id: "2",
    title: "Deadline: Q4 Estimates",
    description: "Quarterly estimated tax payments due",
    startTime: new Date(2025, 0, 3, 14, 0),
    endTime: new Date(2025, 0, 3, 15, 0),
    color: "bg-accent",
    allDay: false,
  },
  {
    id: "3",
    title: "Team Meeting",
    description: "Weekly team sync",
    startTime: new Date(2025, 0, 5, 9, 0),
    endTime: new Date(2025, 0, 5, 10, 0),
    color: "bg-green-500",
    allDay: false,
  },
  {
    id: "4",
    title: "IRS Filing Deadline",
    description: "Important deadline",
    startTime: new Date(2025, 0, 8, 0, 0),
    endTime: new Date(2025, 0, 8, 23, 59),
    color: "bg-red-500",
    allDay: true,
  },
  {
    id: "5",
    title: "New Client Onboarding",
    description: "Williams Consulting onboarding session",
    startTime: new Date(2025, 0, 10, 14, 0),
    endTime: new Date(2025, 0, 10, 16, 0),
    color: "bg-primary",
    allDay: false,
  },
];

const calendarTypes = [
  { name: "Meetings", color: "bg-primary" },
  { name: "Deadlines", color: "bg-accent" },
  { name: "Team Events", color: "bg-green-500" },
  { name: "Reminders", color: "bg-orange-500" },
];

type ViewType = "month" | "week" | "day" | "list";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2025, 0, 3));
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    new Date(2025, 0, 3)
  );
  const [view, setView] = useState<ViewType>("week");

  const navigatePrev = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const navigateNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date(2025, 0, 3)); // Using mock "today"
    setSelectedDate(new Date(2025, 0, 3));
  };

  const getEventsForDate = (date: Date) => {
    return mockEvents.filter((event) => isSameDay(event.startTime, date));
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <>
      <Header title="Calendar" />
      <main className="p-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-72 space-y-6">
            {/* Add Event Button */}
            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full bg-primary hover:bg-primary/90">
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Event
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create New Event</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="eventTitle">Event Title</Label>
                    <Input id="eventTitle" placeholder="Enter event title" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="eventDescription">Description</Label>
                    <Textarea
                      id="eventDescription"
                      placeholder="Enter event description"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Time</Label>
                      <Input type="time" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input type="time" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Calendar Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {calendarTypes.map((type) => (
                          <SelectItem key={type.name} value={type.name}>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn("w-2 h-2 rounded-full", type.color)}
                              />
                              {type.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline">Cancel</Button>
                  <Button className="bg-primary">Create Event</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Mini Calendar */}
            <Card>
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  month={currentDate}
                  onMonthChange={setCurrentDate}
                  className="rounded-md"
                />
              </CardContent>
            </Card>

            {/* My Calendars */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">
                    My Calendars
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {calendarTypes.map((type) => (
                  <div
                    key={type.name}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={cn("w-3 h-3 rounded-full", type.color)}
                    />
                    <span>{type.name}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main Calendar Area */}
          <Card className="flex-1">
            <CardHeader className="flex flex-row items-center justify-between border-b">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={navigatePrev}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToToday}>
                    Today
                  </Button>
                  <Button variant="ghost" size="icon" onClick={navigateNext}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <h2 className="text-lg font-semibold">
                  {format(currentDate, "MMMM yyyy")}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                {(["month", "week", "day", "list"] as ViewType[]).map((v) => (
                  <Button
                    key={v}
                    variant={view === v ? "default" : "outline"}
                    size="sm"
                    onClick={() => setView(v)}
                    className={cn(
                      "capitalize",
                      view === v && "bg-primary text-primary-foreground"
                    )}
                  >
                    {v}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {view === "week" && (
                <div className="flex flex-col">
                  {/* Week Header */}
                  <div className="grid grid-cols-8 border-b">
                    <div className="p-2 text-xs text-muted-foreground" />
                    {getWeekDays().map((day) => (
                      <div
                        key={day.toISOString()}
                        className="p-2 text-center border-l"
                      >
                        <div className="text-xs text-muted-foreground">
                          {format(day, "EEE")}
                        </div>
                        <div
                          className={cn(
                            "text-lg font-semibold",
                            isSameDay(day, new Date(2025, 0, 3)) &&
                              "w-8 h-8 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Time Grid */}
                  <ScrollArea className="h-[600px]">
                    <div className="grid grid-cols-8">
                      {/* All Day Row */}
                      <div className="p-2 text-xs text-muted-foreground border-b">
                        all-day
                      </div>
                      {getWeekDays().map((day) => {
                        const dayEvents = getEventsForDate(day).filter(
                          (e) => e.allDay
                        );
                        return (
                          <div
                            key={`allday-${day.toISOString()}`}
                            className="p-1 border-l border-b min-h-[40px]"
                          >
                            {dayEvents.map((event) => (
                              <div
                                key={event.id}
                                className={cn(
                                  "text-xs p-1 rounded text-white truncate",
                                  event.color
                                )}
                              >
                                {event.title}
                              </div>
                            ))}
                          </div>
                        );
                      })}

                      {/* Hour Rows */}
                      {hours.map((hour) => (
                        <>
                          <div
                            key={`hour-${hour}`}
                            className="p-2 text-xs text-muted-foreground text-right pr-3 border-b h-16"
                          >
                            {hour === 0
                              ? "12am"
                              : hour < 12
                              ? `${hour}am`
                              : hour === 12
                              ? "12pm"
                              : `${hour - 12}pm`}
                          </div>
                          {getWeekDays().map((day) => {
                            const dayEvents = getEventsForDate(day).filter(
                              (e) =>
                                !e.allDay &&
                                e.startTime.getHours() === hour
                            );
                            return (
                              <div
                                key={`${day.toISOString()}-${hour}`}
                                className="border-l border-b h-16 p-1 relative"
                              >
                                {dayEvents.map((event) => (
                                  <div
                                    key={event.id}
                                    className={cn(
                                      "text-xs p-1 rounded text-white absolute left-1 right-1",
                                      event.color
                                    )}
                                    style={{
                                      top: `${(event.startTime.getMinutes() / 60) * 100}%`,
                                    }}
                                  >
                                    <div className="font-medium truncate">
                                      {event.title}
                                    </div>
                                    <div className="opacity-80">
                                      {format(event.startTime, "h:mm a")}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          })}
                        </>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {view === "list" && (
                <div className="p-4 space-y-4">
                  {mockEvents.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div
                        className={cn(
                          "w-1 h-full min-h-[60px] rounded-full",
                          event.color
                        )}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                          <span>{format(event.startTime, "dd MMM")}</span>
                          <span>
                            {format(event.startTime, "EEE")}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(event.startTime, "h:mm a")} -{" "}
                            {format(event.endTime, "h:mm a")}
                          </span>
                        </div>
                        <h3 className="font-medium">{event.title}</h3>
                        <p className="text-sm text-muted-foreground">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {view === "month" && (
                <div className="p-4">
                  <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                      (day) => (
                        <div
                          key={day}
                          className="p-2 text-center text-sm font-medium bg-background"
                        >
                          {day}
                        </div>
                      )
                    )}
                    {eachDayOfInterval({
                      start: startOfWeek(startOfMonth(currentDate)),
                      end: endOfWeek(endOfMonth(currentDate)),
                    }).map((day) => {
                      const dayEvents = getEventsForDate(day);
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-[100px] p-2 bg-background",
                            !isSameMonth(day, currentDate) && "text-muted-foreground bg-muted/30"
                          )}
                        >
                          <div
                            className={cn(
                              "text-sm mb-1",
                              isSameDay(day, new Date(2025, 0, 3)) &&
                                "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                            )}
                          >
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1">
                            {dayEvents.slice(0, 2).map((event) => (
                              <div
                                key={event.id}
                                className={cn(
                                  "text-xs p-1 rounded text-white truncate",
                                  event.color
                                )}
                              >
                                {event.title}
                              </div>
                            ))}
                            {dayEvents.length > 2 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayEvents.length - 2} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {view === "day" && (
                <ScrollArea className="h-[600px]">
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-4">
                      {format(currentDate, "EEEE, MMMM d, yyyy")}
                    </h3>
                    <div className="space-y-2">
                      {hours.map((hour) => {
                        const hourEvents = mockEvents.filter(
                          (e) =>
                            isSameDay(e.startTime, currentDate) &&
                            e.startTime.getHours() === hour
                        );
                        return (
                          <div key={hour} className="flex gap-4">
                            <div className="w-16 text-sm text-muted-foreground text-right">
                              {hour === 0
                                ? "12am"
                                : hour < 12
                                ? `${hour}am`
                                : hour === 12
                                ? "12pm"
                                : `${hour - 12}pm`}
                            </div>
                            <div className="flex-1 min-h-[60px] border-t pt-2">
                              {hourEvents.map((event) => (
                                <div
                                  key={event.id}
                                  className={cn(
                                    "p-2 rounded text-white mb-2",
                                    event.color
                                  )}
                                >
                                  <div className="font-medium">{event.title}</div>
                                  <div className="text-sm opacity-80">
                                    {format(event.startTime, "h:mm a")} -{" "}
                                    {format(event.endTime, "h:mm a")}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
