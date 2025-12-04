"use client";

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";

export interface NotificationCounts {
  general: number;
  messages: number;
  chat: number;
}

export interface TaskProgress {
  completed: number;
  total: number;
}

interface NotificationContextType {
  counts: NotificationCounts;
  taskProgress: TaskProgress;
  updateCounts: (counts: Partial<NotificationCounts>) => void;
  updateTaskProgress: (progress: Partial<TaskProgress>) => void;
  decrementCount: (type: keyof NotificationCounts) => void;
  incrementCount: (type: keyof NotificationCounts) => void;
  markTaskComplete: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

interface NotificationProviderProps {
  children: ReactNode;
  initialCounts?: Partial<NotificationCounts>;
  initialTaskProgress?: Partial<TaskProgress>;
}

export function NotificationProvider({
  children,
  initialCounts,
  initialTaskProgress,
}: NotificationProviderProps) {
  const [counts, setCounts] = useState<NotificationCounts>({
    general: initialCounts?.general ?? 0,
    messages: initialCounts?.messages ?? 0,
    chat: initialCounts?.chat ?? 0,
  });

  const [taskProgress, setTaskProgress] = useState<TaskProgress>({
    completed: initialTaskProgress?.completed ?? 0,
    total: initialTaskProgress?.total ?? 0,
  });

  const updateCounts = useCallback((newCounts: Partial<NotificationCounts>) => {
    setCounts((prev) => ({ ...prev, ...newCounts }));
  }, []);

  const updateTaskProgress = useCallback((progress: Partial<TaskProgress>) => {
    setTaskProgress((prev) => ({ ...prev, ...progress }));
  }, []);

  const decrementCount = useCallback((type: keyof NotificationCounts) => {
    setCounts((prev) => ({
      ...prev,
      [type]: Math.max(0, prev[type] - 1),
    }));
  }, []);

  const incrementCount = useCallback((type: keyof NotificationCounts) => {
    setCounts((prev) => ({
      ...prev,
      [type]: prev[type] + 1,
    }));
  }, []);

  const markTaskComplete = useCallback(() => {
    setTaskProgress((prev) => ({
      ...prev,
      completed: Math.min(prev.completed + 1, prev.total),
    }));
  }, []);

  const contextValue = useMemo(
    () => ({
      counts,
      taskProgress,
      updateCounts,
      updateTaskProgress,
      decrementCount,
      incrementCount,
      markTaskComplete,
    }),
    [counts, taskProgress, updateCounts, updateTaskProgress, decrementCount, incrementCount, markTaskComplete]
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}

// Helper to calculate progress percentage
export function getProgressPercentage(progress: TaskProgress): number {
  if (progress.total === 0) return 0;
  return Math.round((progress.completed / progress.total) * 100);
}
