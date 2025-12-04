// Enterprise Calendar Types

export type CalendarProvider = "local" | "google" | "microsoft";

export type EventStatus = "confirmed" | "tentative" | "cancelled";

export type EventVisibility = "default" | "public" | "private" | "confidential";

export type RecurrenceFrequency = "daily" | "weekly" | "monthly" | "yearly";

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval?: number; // Every X days/weeks/months/years
  count?: number; // Number of occurrences
  until?: Date; // End date
  byDay?: string[]; // For weekly: ["MO", "WE", "FR"]
  byMonthDay?: number[]; // For monthly: [1, 15]
  byMonth?: number[]; // For yearly: [1, 6, 12]
}

export interface EventAttendee {
  email: string;
  name?: string;
  status: "accepted" | "declined" | "tentative" | "needsAction";
  optional?: boolean;
  organizer?: boolean;
}

export interface EventReminder {
  method: "email" | "popup" | "sms";
  minutes: number;
}

export interface CalendarEvent {
  id: string;
  externalId?: string; // ID from Google/Microsoft
  provider: CalendarProvider;

  // Basic info
  title: string;
  description?: string;
  location?: string;

  // Time
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  timezone?: string;

  // Recurrence
  isRecurring: boolean;
  recurrenceRule?: RecurrenceRule;
  recurringEventId?: string; // Parent event ID for recurring instances

  // Status
  status: EventStatus;
  visibility: EventVisibility;

  // People
  organizer?: EventAttendee;
  attendees: EventAttendee[];

  // Reminders
  reminders: EventReminder[];

  // Links
  meetingLink?: string; // Zoom, Teams, Meet link
  webLink?: string; // Link to event in calendar

  // CRM Integration
  clientId?: string;
  clientName?: string;
  taskId?: string;

  // Metadata
  color?: string;
  category?: EventCategory;
  tags?: string[];
  notes?: string;

  // AI Features
  aiGenerated?: boolean;
  aiSuggestedTime?: boolean;
  conflictWarning?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export type EventCategory =
  | "client_meeting"
  | "internal_meeting"
  | "deadline"
  | "reminder"
  | "follow_up"
  | "consultation"
  | "document_review"
  | "tax_filing"
  | "phone_call"
  | "personal"
  | "other";

export const categoryInfo: Record<EventCategory, { label: string; color: string; icon: string }> = {
  client_meeting: { label: "Client Meeting", color: "bg-blue-500", icon: "Users" },
  internal_meeting: { label: "Internal Meeting", color: "bg-green-500", icon: "UserGroup" },
  deadline: { label: "Deadline", color: "bg-red-500", icon: "AlertCircle" },
  reminder: { label: "Reminder", color: "bg-amber-500", icon: "Bell" },
  follow_up: { label: "Follow Up", color: "bg-violet-500", icon: "PhoneCallback" },
  consultation: { label: "Consultation", color: "bg-cyan-500", icon: "MessageSquare" },
  document_review: { label: "Document Review", color: "bg-orange-500", icon: "FileText" },
  tax_filing: { label: "Tax Filing", color: "bg-emerald-500", icon: "FileCheck" },
  phone_call: { label: "Phone Call", color: "bg-indigo-500", icon: "Phone" },
  personal: { label: "Personal", color: "bg-pink-500", icon: "User" },
  other: { label: "Other", color: "bg-gray-500", icon: "Calendar" },
};

export interface CalendarConnection {
  id: string;
  userId: string;
  provider: CalendarProvider;
  email: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  calendarId?: string; // Primary calendar ID
  syncEnabled: boolean;
  lastSyncAt?: Date;
  createdAt: Date;
}

export interface CalendarSettings {
  defaultView: "month" | "week" | "day" | "list";
  weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday
  workingHours: {
    start: string; // "09:00"
    end: string; // "17:00"
  };
  workingDays: number[]; // [1, 2, 3, 4, 5] = Mon-Fri
  defaultEventDuration: number; // minutes
  defaultReminders: EventReminder[];
  timezone: string;
  showWeekNumbers: boolean;
  showDeclinedEvents: boolean;
}

// AI Scheduling Types
export interface TimeSlot {
  start: Date;
  end: Date;
  score?: number; // AI confidence score 0-1
  reason?: string; // Why this slot is suggested
}

export interface SchedulingRequest {
  title: string;
  duration: number; // minutes
  attendees?: string[]; // emails
  preferredDays?: number[]; // 0-6
  preferredTimeRange?: {
    start: string; // "09:00"
    end: string; // "17:00"
  };
  deadline?: Date; // Must be scheduled before this
  priority?: "low" | "medium" | "high";
  category?: EventCategory;
  clientId?: string;
  notes?: string;
}

export interface SchedulingSuggestion {
  slots: TimeSlot[];
  conflicts: CalendarEvent[];
  recommendations: string[];
}

// Sync types
export interface SyncResult {
  provider: CalendarProvider;
  added: number;
  updated: number;
  deleted: number;
  errors: string[];
  lastSyncAt: Date;
}

// Filter/View types
export interface CalendarFilter {
  providers?: CalendarProvider[];
  categories?: EventCategory[];
  status?: EventStatus[];
  clientId?: string;
  searchQuery?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}
