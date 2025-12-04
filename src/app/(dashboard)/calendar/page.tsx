"use client";

import React, { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  MapPin,
  Users,
  Video,
  Mail,
  Phone,
  CalendarDays,
  Settings,
  RefreshCw,
  Sparkles,
  Bot,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Trash2,
  Edit,
  Copy,
  MoreHorizontal,
  Link2,
  Bell,
  Repeat,
  User,
  Building,
  Search,
  Filter,
  X,
  Loader2,
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
  subDays,
  addWeeks,
  subWeeks,
  parseISO,
  differenceInMinutes,
  isToday,
  isBefore,
  isAfter,
  setHours,
  setMinutes,
} from "date-fns";
import type {
  CalendarEvent,
  EventCategory,
  CalendarProvider,
  TimeSlot,
} from "@/lib/calendar/types";
import { categoryInfo } from "@/lib/calendar/types";

// View types
type ViewType = "month" | "week" | "day" | "schedule";

// Empty connections array - real data comes from calendar integrations
const calendarConnections: { id: string; provider: "microsoft" | "google"; email: string; syncEnabled: boolean }[] = [];

// Empty events array - real data comes from calendar integrations
const initialEvents: CalendarEvent[] = [];

// Category options for the form
const categoryOptions: { value: EventCategory; label: string; color: string }[] = [
  { value: "client_meeting", label: "Client Meeting", color: "bg-blue-500" },
  { value: "internal_meeting", label: "Internal Meeting", color: "bg-green-500" },
  { value: "deadline", label: "Deadline", color: "bg-red-500" },
  { value: "reminder", label: "Reminder", color: "bg-amber-500" },
  { value: "follow_up", label: "Follow Up", color: "bg-violet-500" },
  { value: "consultation", label: "Consultation", color: "bg-cyan-500" },
  { value: "document_review", label: "Document Review", color: "bg-orange-500" },
  { value: "tax_filing", label: "Tax Filing", color: "bg-emerald-500" },
  { value: "phone_call", label: "Phone Call", color: "bg-indigo-500" },
  { value: "personal", label: "Personal", color: "bg-pink-500" },
  { value: "other", label: "Other", color: "bg-gray-500" },
];

// Provider icons
const providerIcons: Record<CalendarProvider, React.ReactNode> = {
  local: <CalendarDays className="h-3 w-3" />,
  google: (
    <svg className="h-3 w-3" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  ),
  microsoft: (
    <svg className="h-3 w-3" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
      <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
      <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
    </svg>
  ),
};

// Event Card Component
function EventCard({
  event,
  compact = false,
  onClick,
}: {
  event: CalendarEvent;
  compact?: boolean;
  onClick?: () => void;
}) {
  const category = categoryInfo[event.category || "other"];

  if (compact) {
    return (
      <div
        onClick={onClick}
        className={cn(
          "text-xs p-1 rounded text-white truncate cursor-pointer hover:opacity-90 transition-opacity",
          event.color || category.color
        )}
      >
        {!event.allDay && (
          <span className="opacity-80 mr-1">{format(event.startTime, "h:mm")}</span>
        )}
        {event.title}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className={cn(
        "p-2 rounded-lg text-white cursor-pointer hover:opacity-90 transition-opacity",
        event.color || category.color
      )}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {providerIcons[event.provider]}
        <span className="font-medium text-sm truncate">{event.title}</span>
      </div>
      <div className="flex items-center gap-2 text-xs opacity-90">
        <span>{format(event.startTime, "h:mm a")}</span>
        {event.location && (
          <span className="flex items-center gap-0.5 truncate">
            <MapPin className="h-3 w-3" />
            {event.location}
          </span>
        )}
      </div>
    </div>
  );
}

// Event Detail Modal
function EventDetailModal({
  event,
  open,
  onClose,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent | null;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!event) return null;

  const category = categoryInfo[event.category || "other"];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded", event.color || category.color)} />
            {providerIcons[event.provider]}
            <DialogTitle className="flex-1">{event.title}</DialogTitle>
          </div>
          <DialogDescription className="text-left">
            {event.allDay ? (
              <span>{format(event.startTime, "EEEE, MMMM d, yyyy")}</span>
            ) : (
              <span>
                {format(event.startTime, "EEEE, MMMM d, yyyy")} ·{" "}
                {format(event.startTime, "h:mm a")} - {format(event.endTime, "h:mm a")}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 flex-1 min-h-0 overflow-y-auto">
          {event.location && (
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span className="text-sm">{event.location}</span>
            </div>
          )}

          {event.meetingLink && (
            <div className="flex items-start gap-3">
              <Video className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <a
                href={event.meetingLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1"
              >
                Join Meeting <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {event.description && (
            <div className="flex items-start gap-3">
              <CalendarDays className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{event.description}</p>
            </div>
          )}

          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-start gap-3">
              <Users className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div className="space-y-1">
                {event.attendees.map((attendee, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span>{attendee.name || attendee.email}</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        attendee.status === "accepted" && "bg-green-100 text-green-700",
                        attendee.status === "declined" && "bg-red-100 text-red-700",
                        attendee.status === "tentative" && "bg-amber-100 text-amber-700"
                      )}
                    >
                      {attendee.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {event.clientName && (
            <div className="flex items-start gap-3">
              <Building className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span className="text-sm">Client: {event.clientName}</span>
            </div>
          )}

          {event.isRecurring && (
            <div className="flex items-start gap-3">
              <Repeat className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Recurring: {event.recurrenceRule?.frequency}
              </span>
            </div>
          )}

          <div className="flex items-start gap-3">
            <Badge variant="outline" className="text-xs">
              {category.label}
            </Badge>
            {event.status === "tentative" && (
              <Badge variant="outline" className="text-xs bg-amber-50">
                Tentative
              </Badge>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          {event.webLink && (
            <Button size="sm" asChild>
              <a href={event.webLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// AI Scheduling Dialog
function AISchedulingDialog({
  open,
  onClose,
  onSchedule,
}: {
  open: boolean;
  onClose: () => void;
  onSchedule: (slot: TimeSlot, title: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("60");
  const [category, setCategory] = useState<EventCategory>("client_meeting");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<TimeSlot[]>([]);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  const findSlots = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/calendar/ai-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          duration: parseInt(duration),
          category,
          notes,
          preferredDays: [1, 2, 3, 4, 5],
          preferredTimeRange: { start: "09:00", end: "17:00" },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSuggestions(data.slots || []);
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      console.error("AI scheduling error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Smart Scheduling
          </DialogTitle>
          <DialogDescription>
            Let AI find the best time for your meeting based on your calendar availability
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4 flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Meeting Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Client Tax Review"
              />
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="45">45 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="90">1.5 hours</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded", opt.color)} />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes for AI</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any preferences? e.g., 'Prefer mornings', 'Avoid Mondays'"
                rows={3}
              />
            </div>

            <Button onClick={findSlots} disabled={!title || loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Finding optimal times...
                </>
              ) : (
                <>
                  <Bot className="h-4 w-4 mr-2" />
                  Find Best Times
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            <Label>AI Suggested Times</Label>
            {suggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Enter details and click "Find Best Times"</p>
              </div>
            ) : (
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 pr-4">
                  {suggestions.map((slot, idx) => (
                    <Card
                      key={idx}
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => onSchedule(slot, title)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">
                              {format(new Date(slot.start), "EEEE, MMM d")}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(slot.start), "h:mm a")} -{" "}
                              {format(new Date(slot.end), "h:mm a")}
                            </div>
                          </div>
                          {slot.score !== undefined && (
                            <Badge
                              variant="outline"
                              className={cn(
                                slot.score >= 0.8 && "bg-green-100 text-green-700",
                                slot.score >= 0.5 && slot.score < 0.8 && "bg-amber-100 text-amber-700",
                                slot.score < 0.5 && "bg-gray-100"
                              )}
                            >
                              {Math.round(slot.score * 100)}% match
                            </Badge>
                          )}
                        </div>
                        {slot.reason && (
                          <p className="text-xs text-muted-foreground mt-1">{slot.reason}</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            )}

            {recommendations.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">AI Insights</Label>
                <div className="space-y-1">
                  {recommendations.map((rec, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <CheckCircle className="h-3 w-3 mt-0.5 text-green-500" />
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Create Event Dialog
function CreateEventDialog({
  open,
  onClose,
  initialDate,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialDate?: Date;
  onSave: (event: Partial<CalendarEvent>) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState(format(initialDate || new Date(), "yyyy-MM-dd"));
  const [startTime, setStartTime] = useState("09:00");
  const [endDate, setEndDate] = useState(format(initialDate || new Date(), "yyyy-MM-dd"));
  const [endTime, setEndTime] = useState("10:00");
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>("client_meeting");
  const [meetingLink, setMeetingLink] = useState("");
  const [attendees, setAttendees] = useState("");
  const [syncToExternal, setSyncToExternal] = useState(true);

  const handleSave = () => {
    const start = allDay
      ? new Date(`${startDate}T00:00:00`)
      : new Date(`${startDate}T${startTime}:00`);
    const end = allDay
      ? new Date(`${endDate}T23:59:59`)
      : new Date(`${endDate}T${endTime}:00`);

    onSave({
      title,
      description,
      location,
      startTime: start,
      endTime: end,
      allDay,
      category,
      meetingLink,
      attendees: attendees
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean)
        .map((email) => ({ email, status: "needsAction" as const })),
    });

    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Create New Event</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4 flex-1 min-h-0 overflow-y-auto pr-2">
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter event title"
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as EventCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded", opt.color)} />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={allDay} onCheckedChange={setAllDay} id="allDay" />
            <Label htmlFor="allDay">All day event</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Location</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Add location or meeting room"
            />
          </div>

          <div className="space-y-2">
            <Label>Meeting Link</Label>
            <Input
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              placeholder="https://zoom.us/j/..."
            />
          </div>

          <div className="space-y-2">
            <Label>Attendees (comma-separated emails)</Label>
            <Input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="john@example.com, jane@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add event description"
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={syncToExternal} onCheckedChange={setSyncToExternal} id="sync" />
            <Label htmlFor="sync" className="text-sm text-muted-foreground">
              Sync to connected calendars (Microsoft/Google)
            </Label>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!title}>
            Create Event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Main Calendar Page
export default function CalendarPage() {
  const [mounted, setMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [view, setView] = useState<ViewType>("week");
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [showEventDetail, setShowEventDetail] = useState(false);
  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [showAIScheduling, setShowAIScheduling] = useState(false);
  const [createEventDate, setCreateEventDate] = useState<Date | undefined>();
  const [syncing, setSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategories, setFilterCategories] = useState<EventCategory[]>([]);
  const [filterProviders, setFilterProviders] = useState<CalendarProvider[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigation handlers
  const navigatePrev = () => {
    if (view === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(subWeeks(currentDate, 1));
    } else if (view === "day") {
      setCurrentDate(subDays(currentDate, 1));
    }
  };

  const navigateNext = () => {
    if (view === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (view === "week") {
      setCurrentDate(addWeeks(currentDate, 1));
    } else if (view === "day") {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Get events for a specific date
  const getEventsForDate = useCallback((date: Date) => {
    return events.filter((event) => isSameDay(event.startTime, date));
  }, [events]);

  // Get week days
  const getWeekDays = useCallback(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Filter events
  const filteredEvents = useMemo(() => {
    let result = events;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (e) =>
          e.title.toLowerCase().includes(query) ||
          e.description?.toLowerCase().includes(query) ||
          e.clientName?.toLowerCase().includes(query)
      );
    }

    if (filterCategories.length > 0) {
      result = result.filter((e) => e.category && filterCategories.includes(e.category));
    }

    if (filterProviders.length > 0) {
      result = result.filter((e) => filterProviders.includes(e.provider));
    }

    return result;
  }, [events, searchQuery, filterCategories, filterProviders]);

  // Sync calendars
  const syncCalendars = async () => {
    setSyncing(true);
    try {
      // Fetch from Microsoft
      const msResponse = await fetch("/api/calendar/events");
      if (msResponse.ok) {
        const msData = await msResponse.json();
        // Merge with existing events
        console.log("Synced Microsoft events:", msData.events?.length || 0);
      }

      // Could also sync Google here
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setSyncing(false);
    }
  };

  // Create event handler
  const handleCreateEvent = (eventData: Partial<CalendarEvent>) => {
    const newEvent: CalendarEvent = {
      id: `local-${Date.now()}`,
      provider: "local",
      title: eventData.title || "Untitled",
      description: eventData.description,
      location: eventData.location,
      startTime: eventData.startTime || new Date(),
      endTime: eventData.endTime || new Date(),
      allDay: eventData.allDay || false,
      isRecurring: false,
      status: "confirmed",
      visibility: "default",
      attendees: eventData.attendees || [],
      reminders: [{ method: "popup", minutes: 15 }],
      category: eventData.category,
      color: categoryOptions.find((c) => c.value === eventData.category)?.color,
      meetingLink: eventData.meetingLink,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setEvents([...events, newEvent]);
  };

  // AI Schedule handler
  const handleAISchedule = (slot: TimeSlot, title: string) => {
    setCreateEventDate(new Date(slot.start));
    setShowAIScheduling(false);
    setShowCreateEvent(true);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  if (!mounted) return null;

  return (
    <TooltipProvider delayDuration={0}>
      <Header title="Calendar" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="min-h-14 border-b bg-card flex items-center px-6 py-2 gap-3 flex-shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigatePrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={goToToday}>
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={navigateNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <h2 className="text-base font-semibold whitespace-nowrap">
            {view === "month" && format(currentDate, "MMMM yyyy")}
            {view === "week" && `${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`}
            {view === "day" && format(currentDate, "EEEE, MMMM d, yyyy")}
            {view === "schedule" && "Schedule"}
          </h2>

          <div className="flex-1 min-w-4" />

          {/* Search */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-[160px] h-8 pl-9 text-sm"
            />
          </div>

          {/* Filter Toggle */}
          <Button
            variant={showFilters ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
          </Button>

          {/* View Switcher */}
          <div className="flex items-center border rounded-lg p-0.5">
            {(["month", "week", "day", "schedule"] as ViewType[]).map((v) => (
              <Button
                key={v}
                variant={view === v ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setView(v)}
                className="capitalize h-7 px-2 text-xs"
              >
                {v === "schedule" ? "Sched" : v.charAt(0).toUpperCase() + v.slice(1)}
              </Button>
            ))}
          </div>

          {/* Sync Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={syncCalendars} disabled={syncing}>
                <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Sync calendars</TooltipContent>
          </Tooltip>

          {/* AI Schedule Button */}
          <Button variant="outline" size="sm" className="h-8" onClick={() => setShowAIScheduling(true)}>
            <Sparkles className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">AI Schedule</span>
            <span className="sm:hidden">AI</span>
          </Button>

          {/* Add Event */}
          <Button size="sm" className="h-8" onClick={() => setShowCreateEvent(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </Button>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="h-12 border-b bg-muted/30 flex items-center px-6 gap-4 flex-shrink-0">
            <span className="text-sm text-muted-foreground">Filters:</span>

            {/* Category Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7">
                  Categories
                  {filterCategories.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-4 px-1">
                      {filterCategories.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {categoryOptions.map((cat) => (
                  <DropdownMenuItem
                    key={cat.value}
                    onClick={() => {
                      setFilterCategories((prev) =>
                        prev.includes(cat.value)
                          ? prev.filter((c) => c !== cat.value)
                          : [...prev, cat.value]
                      );
                    }}
                  >
                    <Checkbox
                      checked={filterCategories.includes(cat.value)}
                      className="mr-2"
                    />
                    <div className={cn("w-2 h-2 rounded mr-2", cat.color)} />
                    {cat.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Provider Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7">
                  Calendars
                  {filterProviders.length > 0 && (
                    <Badge variant="secondary" className="ml-2 h-4 px-1">
                      {filterProviders.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {(["local", "microsoft", "google"] as CalendarProvider[]).map((prov) => (
                  <DropdownMenuItem
                    key={prov}
                    onClick={() => {
                      setFilterProviders((prev) =>
                        prev.includes(prov)
                          ? prev.filter((p) => p !== prov)
                          : [...prev, prov]
                      );
                    }}
                  >
                    <Checkbox checked={filterProviders.includes(prov)} className="mr-2" />
                    {providerIcons[prov]}
                    <span className="ml-2 capitalize">{prov}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {(filterCategories.length > 0 || filterProviders.length > 0) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => {
                  setFilterCategories([]);
                  setFilterProviders([]);
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar */}
          <div className="w-72 flex-shrink-0 border-r bg-muted/30 p-4 flex flex-col gap-4 overflow-y-auto">
            {/* Mini Calendar */}
            <Card className="overflow-hidden">
              <CardContent className="p-3">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    if (date) setCurrentDate(date);
                  }}
                  month={currentDate}
                  onMonthChange={setCurrentDate}
                  className="rounded-md w-full"
                />
              </CardContent>
            </Card>

            {/* Connected Calendars */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">Connected Calendars</CardTitle>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  {providerIcons.local}
                  <span>Local Calendar</span>
                  <Badge variant="outline" className="ml-auto text-xs">Active</Badge>
                </div>
                {calendarConnections.map((conn) => (
                  <div key={conn.id} className="flex items-center gap-2 text-sm">
                    {providerIcons[conn.provider]}
                    <span className="truncate flex-1">{conn.email}</span>
                    <Badge
                      variant="outline"
                      className={cn("text-xs", conn.syncEnabled && "bg-green-100")}
                    >
                      {conn.syncEnabled ? "Synced" : "Off"}
                    </Badge>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2">
                  <Plus className="h-4 w-4 mr-2" />
                  Connect Calendar
                </Button>
              </CardContent>
            </Card>

            {/* Categories */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">Categories</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-1">
                {categoryOptions.slice(0, 6).map((cat) => (
                  <div key={cat.value} className="flex items-center gap-2 text-sm">
                    <div className={cn("w-3 h-3 rounded", cat.color)} />
                    <span>{cat.label}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Upcoming Events */}
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-2">
                {events
                  .filter((e) => isAfter(e.startTime, new Date()))
                  .slice(0, 3)
                  .map((event) => (
                    <div
                      key={event.id}
                      className="flex items-start gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1.5 rounded"
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowEventDetail(true);
                      }}
                    >
                      <div className={cn("w-1.5 h-full min-h-[32px] rounded", event.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{event.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(event.startTime, "MMM d, h:mm a")}
                        </div>
                      </div>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>

          {/* Calendar Grid */}
          <div className="flex-1 overflow-hidden p-4">
            {view === "week" && (
              <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
                {/* Week Header */}
                <div className="grid grid-cols-8 border-b flex-shrink-0 bg-muted/30">
                  <div className="p-2 text-xs text-muted-foreground" />
                  {getWeekDays().map((day) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-2 text-center border-l",
                        isToday(day) && "bg-primary/5"
                      )}
                    >
                      <div className="text-xs text-muted-foreground">
                        {format(day, "EEE")}
                      </div>
                      <div
                        className={cn(
                          "text-lg font-semibold",
                          isToday(day) &&
                            "w-8 h-8 mx-auto rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                        )}
                      >
                        {format(day, "d")}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Time Grid */}
                <ScrollArea className="flex-1">
                  <div className="grid grid-cols-8">
                    {/* All Day Row */}
                    <div className="p-2 text-xs text-muted-foreground border-b">
                      all-day
                    </div>
                    {getWeekDays().map((day) => {
                      const dayEvents = filteredEvents.filter(
                        (e) => isSameDay(e.startTime, day) && e.allDay
                      );
                      return (
                        <div
                          key={`allday-${day.toISOString()}`}
                          className="p-1 border-l border-b min-h-[40px]"
                        >
                          {dayEvents.map((event) => (
                            <EventCard
                              key={event.id}
                              event={event}
                              compact
                              onClick={() => {
                                setSelectedEvent(event);
                                setShowEventDetail(true);
                              }}
                            />
                          ))}
                        </div>
                      );
                    })}

                    {/* Hour Rows */}
                    {hours.map((hour) => (
                      <Fragment key={`hour-${hour}`}>
                        <div className="p-2 text-xs text-muted-foreground text-right pr-3 border-b h-16">
                          {hour === 0
                            ? "12am"
                            : hour < 12
                            ? `${hour}am`
                            : hour === 12
                            ? "12pm"
                            : `${hour - 12}pm`}
                        </div>
                        {getWeekDays().map((day) => {
                          const hourEvents = filteredEvents.filter(
                            (e) =>
                              isSameDay(e.startTime, day) &&
                              !e.allDay &&
                              e.startTime.getHours() === hour
                          );
                          return (
                            <div
                              key={`${day.toISOString()}-${hour}`}
                              className={cn(
                                "border-l border-b h-16 p-0.5 relative",
                                isToday(day) && "bg-primary/5"
                              )}
                              onClick={() => {
                                const clickDate = setMinutes(setHours(day, hour), 0);
                                setCreateEventDate(clickDate);
                                setShowCreateEvent(true);
                              }}
                            >
                              {hourEvents.map((event) => {
                                const duration = differenceInMinutes(
                                  event.endTime,
                                  event.startTime
                                );
                                const height = Math.max((duration / 60) * 64, 24);
                                const top = (event.startTime.getMinutes() / 60) * 64;
                                return (
                                  <div
                                    key={event.id}
                                    className={cn(
                                      "absolute left-0.5 right-0.5 rounded p-1 text-white text-xs overflow-hidden cursor-pointer hover:opacity-90",
                                      event.color || "bg-primary"
                                    )}
                                    style={{
                                      top: `${top}px`,
                                      height: `${height}px`,
                                      minHeight: "24px",
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedEvent(event);
                                      setShowEventDetail(true);
                                    }}
                                  >
                                    <div className="font-medium truncate">
                                      {event.title}
                                    </div>
                                    {height > 32 && (
                                      <div className="opacity-80 truncate">
                                        {format(event.startTime, "h:mm a")}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </Fragment>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {view === "month" && (
              <div className="h-full overflow-auto">
                <div className="grid grid-cols-7 gap-px bg-muted rounded-lg overflow-hidden h-full border">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div
                      key={day}
                      className="p-2 text-center text-sm font-medium bg-background"
                    >
                      {day}
                    </div>
                  ))}
                  {eachDayOfInterval({
                    start: startOfWeek(startOfMonth(currentDate)),
                    end: endOfWeek(endOfMonth(currentDate)),
                  }).map((day) => {
                    const dayEvents = filteredEvents.filter((e) =>
                      isSameDay(e.startTime, day)
                    );
                    return (
                      <div
                        key={day.toISOString()}
                        className={cn(
                          "min-h-[100px] p-2 bg-background cursor-pointer hover:bg-muted/50",
                          !isSameMonth(day, currentDate) && "text-muted-foreground bg-muted/30",
                          isToday(day) && "bg-primary/5"
                        )}
                        onClick={() => {
                          setCreateEventDate(day);
                          setShowCreateEvent(true);
                        }}
                      >
                        <div
                          className={cn(
                            "text-sm mb-1",
                            isToday(day) &&
                              "w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
                          )}
                        >
                          {format(day, "d")}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 3).map((event) => (
                            <EventCard
                              key={event.id}
                              event={event}
                              compact
                              onClick={() => {
                                setSelectedEvent(event);
                                setShowEventDetail(true);
                              }}
                            />
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-muted-foreground pl-1">
                              +{dayEvents.length - 3} more
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
              <ScrollArea className="h-full border rounded-lg bg-background">
                <div className="p-4">
                  <div className="space-y-1">
                    {hours.map((hour) => {
                      const hourEvents = filteredEvents.filter(
                        (e) =>
                          isSameDay(e.startTime, currentDate) &&
                          !e.allDay &&
                          e.startTime.getHours() === hour
                      );
                      return (
                        <div
                          key={hour}
                          className="flex gap-4 min-h-[64px]"
                          onClick={() => {
                            const clickDate = setMinutes(setHours(currentDate, hour), 0);
                            setCreateEventDate(clickDate);
                            setShowCreateEvent(true);
                          }}
                        >
                          <div className="w-16 text-sm text-muted-foreground text-right pt-1 flex-shrink-0">
                            {hour === 0
                              ? "12am"
                              : hour < 12
                              ? `${hour}am`
                              : hour === 12
                              ? "12pm"
                              : `${hour - 12}pm`}
                          </div>
                          <div className="flex-1 border-t pt-2">
                            {hourEvents.map((event) => (
                              <EventCard
                                key={event.id}
                                event={event}
                                onClick={() => {
                                  setSelectedEvent(event);
                                  setShowEventDetail(true);
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            )}

            {view === "schedule" && (
              <ScrollArea className="h-full border rounded-lg bg-background">
                <div className="p-4 space-y-3">
                  {filteredEvents
                    .filter((e) => isAfter(e.endTime, new Date()))
                    .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
                    .map((event) => (
                      <div
                        key={event.id}
                        className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSelectedEvent(event);
                          setShowEventDetail(true);
                        }}
                      >
                        <div
                          className={cn(
                            "w-1 h-full min-h-[60px] rounded-full",
                            event.color
                          )}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            {providerIcons[event.provider]}
                            <span>{format(event.startTime, "EEE, MMM d")}</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {event.allDay
                                ? "All day"
                                : `${format(event.startTime, "h:mm a")} - ${format(event.endTime, "h:mm a")}`}
                            </span>
                          </div>
                          <h3 className="font-medium">{event.title}</h3>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2">
                            {event.location && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </span>
                            )}
                            {event.attendees && event.attendees.length > 0 && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {event.attendees.length} attendees
                              </span>
                            )}
                            {event.meetingLink && (
                              <span className="flex items-center gap-1 text-xs text-primary">
                                <Video className="h-3 w-3" />
                                Video call
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {categoryInfo[event.category || "other"].label}
                        </Badge>
                      </div>
                    ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>

        {/* Dialogs */}
        <EventDetailModal
          event={selectedEvent}
          open={showEventDetail}
          onClose={() => {
            setShowEventDetail(false);
            setSelectedEvent(null);
          }}
          onEdit={() => {
            setShowEventDetail(false);
            // Would open edit dialog
          }}
          onDelete={() => {
            if (selectedEvent) {
              setEvents(events.filter((e) => e.id !== selectedEvent.id));
            }
            setShowEventDetail(false);
            setSelectedEvent(null);
          }}
        />

        <CreateEventDialog
          open={showCreateEvent}
          onClose={() => {
            setShowCreateEvent(false);
            setCreateEventDate(undefined);
          }}
          initialDate={createEventDate}
          onSave={handleCreateEvent}
        />

        <AISchedulingDialog
          open={showAIScheduling}
          onClose={() => setShowAIScheduling(false)}
          onSchedule={handleAISchedule}
        />
      </main>
    </TooltipProvider>
  );
}
