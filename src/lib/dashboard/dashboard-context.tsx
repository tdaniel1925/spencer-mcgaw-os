"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import {
  DashboardPreferences,
  WidgetConfig,
  UserCalendar,
  CalendarWidgetSettings,
  defaultWidgets,
  defaultCalendarSettings,
  calendarColors,
} from "./types";

interface DashboardContextType {
  // Preferences
  preferences: DashboardPreferences | null;
  loading: boolean;

  // Widget management
  widgets: WidgetConfig[];
  toggleWidget: (widgetId: string) => void;
  reorderWidgets: (newOrder: WidgetConfig[]) => void;
  updateWidgetSize: (widgetId: string, size: "small" | "medium" | "large") => void;

  // Calendar management
  calendars: UserCalendar[];
  toggleCalendar: (calendarId: string) => void;
  addCalendar: (name: string, color: string) => void;
  updateCalendar: (calendarId: string, updates: Partial<UserCalendar>) => void;
  removeCalendar: (calendarId: string) => void;
  calendarSettings: CalendarWidgetSettings;
  updateCalendarSettings: (settings: Partial<CalendarWidgetSettings>) => void;

  // Layout presets
  setLayoutPreset: (preset: "default" | "compact" | "detailed" | "custom") => void;

  // Persistence
  savePreferences: () => Promise<void>;
  resetToDefaults: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Local storage key
const DASHBOARD_PREFS_KEY = "dashboard_preferences";

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<DashboardPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Load preferences from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DASHBOARD_PREFS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setPreferences({
          ...parsed,
          createdAt: new Date(parsed.createdAt),
          updatedAt: new Date(parsed.updatedAt),
        });
      } else {
        // Initialize with defaults
        const defaultPrefs: DashboardPreferences = {
          id: generateId(),
          userId: "local",
          layout: "default",
          widgets: defaultWidgets,
          calendarSettings: defaultCalendarSettings,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        setPreferences(defaultPrefs);
        localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(defaultPrefs));
      }
    } catch (error) {
      console.error("Failed to load dashboard preferences:", error);
      // Initialize with defaults on error
      setPreferences({
        id: generateId(),
        userId: "local",
        layout: "default",
        widgets: defaultWidgets,
        calendarSettings: defaultCalendarSettings,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Save preferences to localStorage
  const savePreferences = useCallback(async () => {
    if (preferences) {
      const updated = { ...preferences, updatedAt: new Date() };
      localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(updated));
      setPreferences(updated);
    }
  }, [preferences]);

  // Auto-save on preference changes
  useEffect(() => {
    if (preferences && !loading) {
      const timeout = setTimeout(() => {
        localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(preferences));
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [preferences, loading]);

  // Widget management
  const widgets = useMemo(() => preferences?.widgets || defaultWidgets, [preferences]);

  const toggleWidget = useCallback((widgetId: string) => {
    setPreferences((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        widgets: prev.widgets.map((w) =>
          w.id === widgetId ? { ...w, enabled: !w.enabled } : w
        ),
        updatedAt: new Date(),
      };
    });
  }, []);

  const reorderWidgets = useCallback((newOrder: WidgetConfig[]) => {
    setPreferences((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        widgets: newOrder.map((w, idx) => ({ ...w, order: idx })),
        updatedAt: new Date(),
      };
    });
  }, []);

  const updateWidgetSize = useCallback(
    (widgetId: string, size: "small" | "medium" | "large") => {
      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          widgets: prev.widgets.map((w) =>
            w.id === widgetId ? { ...w, size } : w
          ),
          updatedAt: new Date(),
        };
      });
    },
    []
  );

  // Calendar management
  const calendars = useMemo(
    () => preferences?.calendarSettings.calendars || defaultCalendarSettings.calendars,
    [preferences]
  );

  const calendarSettings = useMemo(
    () => preferences?.calendarSettings || defaultCalendarSettings,
    [preferences]
  );

  const toggleCalendar = useCallback((calendarId: string) => {
    setPreferences((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        calendarSettings: {
          ...prev.calendarSettings,
          calendars: prev.calendarSettings.calendars.map((c) =>
            c.id === calendarId ? { ...c, enabled: !c.enabled } : c
          ),
        },
        updatedAt: new Date(),
      };
    });
  }, []);

  const addCalendar = useCallback((name: string, color: string) => {
    const newCalendar: UserCalendar = {
      id: generateId(),
      name,
      color,
      enabled: true,
      provider: "local",
    };
    setPreferences((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        calendarSettings: {
          ...prev.calendarSettings,
          calendars: [...prev.calendarSettings.calendars, newCalendar],
        },
        updatedAt: new Date(),
      };
    });
  }, []);

  const updateCalendar = useCallback(
    (calendarId: string, updates: Partial<UserCalendar>) => {
      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          calendarSettings: {
            ...prev.calendarSettings,
            calendars: prev.calendarSettings.calendars.map((c) =>
              c.id === calendarId ? { ...c, ...updates } : c
            ),
          },
          updatedAt: new Date(),
        };
      });
    },
    []
  );

  const removeCalendar = useCallback((calendarId: string) => {
    setPreferences((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        calendarSettings: {
          ...prev.calendarSettings,
          calendars: prev.calendarSettings.calendars.filter((c) => c.id !== calendarId),
        },
        updatedAt: new Date(),
      };
    });
  }, []);

  const updateCalendarSettings = useCallback(
    (settings: Partial<CalendarWidgetSettings>) => {
      setPreferences((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          calendarSettings: {
            ...prev.calendarSettings,
            ...settings,
          },
          updatedAt: new Date(),
        };
      });
    },
    []
  );

  // Layout presets
  const setLayoutPreset = useCallback(
    (preset: "default" | "compact" | "detailed" | "custom") => {
      setPreferences((prev) => {
        if (!prev) return prev;

        let newWidgets = [...prev.widgets];

        switch (preset) {
          case "compact":
            // Show only essential widgets
            newWidgets = newWidgets.map((w) => ({
              ...w,
              enabled: ["stats", "tasks", "quick_actions"].includes(w.id),
              size: "small" as const,
            }));
            break;
          case "detailed":
            // Show all widgets with larger sizes
            newWidgets = newWidgets.map((w) => ({
              ...w,
              enabled: true,
              size: "large" as const,
            }));
            break;
          case "default":
            // Reset to defaults
            newWidgets = defaultWidgets;
            break;
          // "custom" keeps current settings
        }

        return {
          ...prev,
          layout: preset,
          widgets: newWidgets,
          updatedAt: new Date(),
        };
      });
    },
    []
  );

  const resetToDefaults = useCallback(() => {
    const defaultPrefs: DashboardPreferences = {
      id: generateId(),
      userId: "local",
      layout: "default",
      widgets: defaultWidgets,
      calendarSettings: defaultCalendarSettings,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setPreferences(defaultPrefs);
    localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(defaultPrefs));
  }, []);

  const contextValue = useMemo(
    () => ({
      preferences,
      loading,
      widgets,
      toggleWidget,
      reorderWidgets,
      updateWidgetSize,
      calendars,
      toggleCalendar,
      addCalendar,
      updateCalendar,
      removeCalendar,
      calendarSettings,
      updateCalendarSettings,
      setLayoutPreset,
      savePreferences,
      resetToDefaults,
    }),
    [
      preferences,
      loading,
      widgets,
      toggleWidget,
      reorderWidgets,
      updateWidgetSize,
      calendars,
      toggleCalendar,
      addCalendar,
      updateCalendar,
      removeCalendar,
      calendarSettings,
      updateCalendarSettings,
      setLayoutPreset,
      savePreferences,
      resetToDefaults,
    ]
  );

  return (
    <DashboardContext.Provider value={contextValue}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const context = useContext(DashboardContext);
  if (context === undefined) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return context;
}
