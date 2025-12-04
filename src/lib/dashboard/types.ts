// Dashboard Widget Types

export type WidgetType =
  | "tasks"
  | "calendar"
  | "calls"
  | "emails"
  | "stats"
  | "quick_actions"
  | "activity";

export type WidgetSize = "small" | "medium" | "large";

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  enabled: boolean;
  size: WidgetSize;
  order: number;
  settings?: Record<string, unknown>;
}

// Calendar-specific types
export interface UserCalendar {
  id: string;
  name: string;
  color: string;
  enabled: boolean;
  provider: "local" | "microsoft" | "google";
  isDefault?: boolean;
}

export interface CalendarWidgetSettings {
  calendars: UserCalendar[];
  showAllDay: boolean;
  showCompleted: boolean;
  defaultView: "agenda" | "timeline";
}

// Dashboard preferences stored per user
export interface DashboardPreferences {
  id: string;
  userId: string;
  layout: "default" | "compact" | "detailed" | "custom";
  widgets: WidgetConfig[];
  calendarSettings: CalendarWidgetSettings;
  theme?: "light" | "dark" | "system";
  createdAt: Date;
  updatedAt: Date;
}

// Default widget configurations
export const defaultWidgets: WidgetConfig[] = [
  { id: "stats", type: "stats", title: "Overview Stats", enabled: true, size: "large", order: 0 },
  { id: "tasks", type: "tasks", title: "Tasks", enabled: true, size: "medium", order: 1 },
  { id: "calendar", type: "calendar", title: "Today's Agenda", enabled: true, size: "medium", order: 2 },
  { id: "calls", type: "calls", title: "Recent Calls", enabled: true, size: "medium", order: 3 },
  { id: "emails", type: "emails", title: "Email Tasks", enabled: true, size: "medium", order: 4 },
  { id: "quick_actions", type: "quick_actions", title: "Quick Actions", enabled: true, size: "small", order: 5 },
  { id: "activity", type: "activity", title: "Recent Activity", enabled: false, size: "medium", order: 6 },
];

// Default calendar colors
export const calendarColors = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Purple", value: "#a855f7" },
  { name: "Orange", value: "#f97316" },
  { name: "Pink", value: "#ec4899" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Red", value: "#ef4444" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
];

// Default calendars
export const defaultCalendars: UserCalendar[] = [
  { id: "work", name: "Work", color: "#3b82f6", enabled: true, provider: "local", isDefault: true },
  { id: "personal", name: "Personal", color: "#22c55e", enabled: true, provider: "local" },
  { id: "deadlines", name: "Deadlines", color: "#ef4444", enabled: true, provider: "local" },
  { id: "client-meetings", name: "Client Meetings", color: "#a855f7", enabled: true, provider: "local" },
];

export const defaultCalendarSettings: CalendarWidgetSettings = {
  calendars: defaultCalendars,
  showAllDay: true,
  showCompleted: false,
  defaultView: "agenda",
};

export const defaultDashboardPreferences: Omit<DashboardPreferences, "id" | "userId" | "createdAt" | "updatedAt"> = {
  layout: "default",
  widgets: defaultWidgets,
  calendarSettings: defaultCalendarSettings,
};
