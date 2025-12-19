"use client";

import { useEffect, useCallback, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface Task {
  id: string;
  title: string;
  status: string;
  assigned_to: string | null;
  priority: string;
  [key: string]: unknown;
}

interface UseRealtimeTasksOptions {
  userId?: string; // Filter to tasks assigned to this user
  onTaskCreated?: (task: Task) => void;
  onTaskUpdated?: (task: Task, oldTask: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
  onTaskAssigned?: (task: Task, assignedTo: string) => void;
  enabled?: boolean;
}

/**
 * Hook to subscribe to real-time task updates via Supabase Realtime
 *
 * Usage:
 * ```tsx
 * const { isConnected } = useRealtimeTasks({
 *   userId: currentUser.id, // Only receive updates for tasks assigned to this user
 *   onTaskCreated: (task) => addTaskToList(task),
 *   onTaskUpdated: (task) => updateTaskInList(task),
 *   onTaskAssigned: (task, assignedTo) => {
 *     if (assignedTo === currentUser.id) showNotification("New task assigned!");
 *   },
 * });
 * ```
 */
export function useRealtimeTasks({
  userId,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
  onTaskAssigned,
  enabled = true,
}: UseRealtimeTasksOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isConnectedRef = useRef(false);

  // Create Supabase client
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleTaskChange = useCallback(
    (payload: RealtimePostgresChangesPayload<Task>) => {
      const { eventType, new: newTask, old: oldTask } = payload;

      switch (eventType) {
        case "INSERT":
          if (newTask) {
            // If filtering by userId, only fire if task is assigned to them
            if (!userId || newTask.assigned_to === userId) {
              onTaskCreated?.(newTask as Task);
            }
          }
          break;

        case "UPDATE":
          if (newTask && oldTask) {
            const task = newTask as Task;
            const old = oldTask as Task;

            // Check if assignment changed
            if (old.assigned_to !== task.assigned_to && task.assigned_to) {
              onTaskAssigned?.(task, task.assigned_to);
            }

            // If filtering by userId, only fire if task is/was assigned to them
            if (!userId || task.assigned_to === userId || old.assigned_to === userId) {
              onTaskUpdated?.(task, old);
            }
          }
          break;

        case "DELETE":
          if (oldTask) {
            const task = oldTask as Task;
            // If filtering by userId, only fire if task was assigned to them
            if (!userId || task.assigned_to === userId) {
              onTaskDeleted?.(task.id);
            }
          }
          break;
      }
    },
    [userId, onTaskCreated, onTaskUpdated, onTaskDeleted, onTaskAssigned]
  );

  useEffect(() => {
    if (!enabled) return;

    // Subscribe to task changes
    const channel = supabase
      .channel("tasks-realtime")
      .on<Task>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
        },
        handleTaskChange
      )
      .subscribe((status) => {
        isConnectedRef.current = status === "SUBSCRIBED";
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Connected to tasks channel");
        } else if (status === "CHANNEL_ERROR") {
          console.error("[Realtime] Error connecting to tasks channel");
        }
      });

    channelRef.current = channel;

    return () => {
      console.log("[Realtime] Unsubscribing from tasks channel");
      channel.unsubscribe();
      channelRef.current = null;
      isConnectedRef.current = false;
    };
  }, [enabled, supabase, handleTaskChange]);

  return {
    isConnected: isConnectedRef.current,
    channel: channelRef.current,
  };
}

/**
 * Hook to subscribe to real-time notification updates
 */
export function useRealtimeNotifications({
  userId,
  onNewNotification,
  enabled = true,
}: {
  userId: string;
  onNewNotification: (notification: {
    id: string;
    type: string;
    title: string;
    message: string | null;
    link: string | null;
    created_at: string;
  }) => void;
  enabled?: boolean;
}) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (!enabled || !userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new) {
            onNewNotification(payload.new as {
              id: string;
              type: string;
              title: string;
              message: string | null;
              link: string | null;
              created_at: string;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[Realtime] Connected to notifications channel");
        }
      });

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [enabled, userId, supabase, onNewNotification]);

  return { channel: channelRef.current };
}

/**
 * Broadcast a task event to connected clients
 * Call this from server actions/API routes after task mutations
 */
export async function broadcastTaskEvent(
  event: "created" | "updated" | "deleted" | "assigned",
  task: Partial<Task>,
  triggeredBy: string
) {
  // This is handled automatically by Supabase Realtime when
  // the database changes - no manual broadcast needed
  console.log(`[Realtime] Task ${event}:`, task.id, "by", triggeredBy);
}
