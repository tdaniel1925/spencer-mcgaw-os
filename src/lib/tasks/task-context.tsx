"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";
import logger from "@/lib/logger";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  source_type: "phone_call" | "email" | "document_intake" | "manual" | null;
  source_email_id: string | null;
  source_metadata: {
    caller_phone?: string;
    caller_name?: string;
    conversation_space_id?: string;
    extraction_summary?: string;
    [key: string]: unknown;
  } | null;
  ai_extracted_data?: {
    client_match?: {
      name?: string;
      email?: string;
      company?: string;
    };
    [key: string]: unknown;
  } | null;
  client_id: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  claimed_by: string | null;
  claimed_at: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  action_type_id: string | null;
  // Relations (optional, populated by API)
  client?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  } | null;
  action_type?: {
    id: string;
    code: string;
    label: string;
    color: string;
    icon: string;
  } | null;
}

export type TaskView = "my-work" | "team-pool" | "all";

interface TaskContextType {
  // State
  tasks: Task[];
  loading: boolean;
  currentView: TaskView;
  searchQuery: string;
  priorityFilter: string;

  // Actions
  setCurrentView: (view: TaskView) => void;
  setSearchQuery: (query: string) => void;
  setPriorityFilter: (priority: string) => void;
  refreshTasks: () => Promise<void>;
  updateTaskStatus: (taskId: string, status: Task["status"]) => Promise<boolean>;
  claimTask: (taskId: string) => Promise<boolean>;
  releaseTask: (taskId: string) => Promise<boolean>;
  assignTask: (taskId: string, assigneeId: string) => Promise<boolean>;

  // Computed
  myTasks: Task[];
  teamPoolTasks: Task[];
  allTasks: Task[];
  taskCounts: {
    myWork: number;
    teamPool: number;
    all: number;
  };
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<TaskView>("my-work");
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const supabase = createClient();
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Fetch tasks - optimized to load active tasks first for faster initial load
  const refreshTasks = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Fetch from the unified tasks API - limit to 100 for faster loading
      // Real-time subscription will add new tasks as they come in
      const params = new URLSearchParams();
      params.set("limit", "100");
      // Exclude old completed tasks from initial load for speed
      params.set("exclude_completed_before", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());
      if (searchQuery) params.set("search", searchQuery);

      const response = await fetch(`/api/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      logger.error("[TaskContext] Error fetching tasks", error);
    } finally {
      setLoading(false);
    }
  }, [user, searchQuery]);

  // Initial fetch
  useEffect(() => {
    if (user?.id) {
      refreshTasks();
    } else {
      // No user yet - stop loading spinner
      setLoading(false);
    }
  }, [user?.id, refreshTasks]);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!user) return;

    // Clean up existing subscription
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    // Subscribe to task changes
    const channel = supabase
      .channel("tasks_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks"
        },
        async (payload) => {
          if (payload.eventType === "INSERT") {
            const newTask = payload.new as Task;
            setTasks(prev => [newTask, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const updatedTask = payload.new as Task;
            setTasks(prev => prev.map(t =>
              t.id === updatedTask.id ? { ...t, ...updatedTask } : t
            ));
          } else if (payload.eventType === "DELETE") {
            const deletedTask = payload.old as Task;
            setTasks(prev => prev.filter(t => t.id !== deletedTask.id));
          }
        }
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, [user, supabase]);

  // Update task status
  const updateTaskStatus = useCallback(async (taskId: string, status: Task["status"]): Promise<boolean> => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          ...(status === "completed" && { completed_at: new Date().toISOString() }),
        }),
      });

      if (response.ok) {
        // Optimistic update (real-time will also update)
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, status } : t
        ));
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[TaskContext] Error updating task status", error);
      return false;
    }
  }, []);

  // Claim task
  const claimTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/claim`, {
        method: "POST",
      });

      if (response.ok) {
        await refreshTasks();
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[TaskContext] Error claiming task", error);
      return false;
    }
  }, [refreshTasks]);

  // Release task
  const releaseTask = useCallback(async (taskId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/claim`, {
        method: "DELETE",
      });

      if (response.ok) {
        await refreshTasks();
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[TaskContext] Error releasing task", error);
      return false;
    }
  }, [refreshTasks]);

  // Assign task
  const assignTask = useCallback(async (taskId: string, assigneeId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: assigneeId }),
      });

      if (response.ok) {
        await refreshTasks();
        return true;
      }
      return false;
    } catch (error) {
      logger.error("[TaskContext] Error assigning task", error);
      return false;
    }
  }, [refreshTasks]);

  // Computed: filter tasks
  const filterByPriority = useCallback((taskList: Task[]) => {
    if (priorityFilter === "all") return taskList;
    return taskList.filter(t => t.priority === priorityFilter);
  }, [priorityFilter]);

  // My tasks: assigned to current user OR claimed by current user
  const myTasks = filterByPriority(
    tasks.filter(t =>
      t.assigned_to === user?.id || t.claimed_by === user?.id
    )
  );

  // Team pool: open tasks not assigned or claimed
  const teamPoolTasks = filterByPriority(
    tasks.filter(t =>
      t.status === "pending" &&
      !t.assigned_to &&
      !t.claimed_by
    )
  );

  // All tasks
  const allTasks = filterByPriority(tasks);

  // Task counts
  const taskCounts = {
    myWork: tasks.filter(t => t.assigned_to === user?.id || t.claimed_by === user?.id).length,
    teamPool: tasks.filter(t => t.status === "pending" && !t.assigned_to && !t.claimed_by).length,
    all: tasks.length,
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        loading,
        currentView,
        searchQuery,
        priorityFilter,
        setCurrentView,
        setSearchQuery,
        setPriorityFilter,
        refreshTasks,
        updateTaskStatus,
        claimTask,
        releaseTask,
        assignTask,
        myTasks,
        teamPoolTasks,
        allTasks,
        taskCounts,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTaskContext() {
  const context = useContext(TaskContext);
  if (context === undefined) {
    throw new Error("useTaskContext must be used within a TaskProvider");
  }
  return context;
}
