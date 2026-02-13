"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/supabase/auth-context";
import logger from "@/lib/logger";

/**
 * Hook to fetch the count of unopened tasks assigned to the current user.
 * A task is considered "unopened" if:
 * - It's assigned to the current user
 * - first_viewed_at is NULL
 * - Status is not "completed"
 *
 * Subscribes to real-time updates for automatic count refresh.
 */
export function useUnopenedTasksCount() {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setCount(0);
      setLoading(false);
      return;
    }

    const supabase = createClient();

    // Initial fetch
    const fetchCount = async () => {
      try {
        const { count: taskCount, error } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", user.id)
          .is("first_viewed_at", null)
          .neq("status", "completed")
          .neq("status", "cancelled");

        if (error) {
          logger.error("Error fetching unopened tasks count", { error });
          setCount(0);
        } else {
          setCount(taskCount || 0);
        }
      } catch (err) {
        logger.error("Error in fetchCount", { error: err });
        setCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchCount();

    // Subscribe to real-time updates
    const channel = supabase
      .channel("unopened-tasks-count")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `assigned_to=eq.${user.id}`,
        },
        () => {
          // Refetch count when tasks change
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user?.id]);

  return { count, loading };
}
