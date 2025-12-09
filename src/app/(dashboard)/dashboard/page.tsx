"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isPast } from "date-fns";

interface Task {
  id: string;
  title: string;
  priority: "urgent" | "high" | "medium" | "low";
  due_date: string | null;
  status: string;
  client_id: string | null;
  source_type: string | null;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  completedToday: number;
  dueToday: number;
  overdue: number;
}

const priorityColors = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-slate-400",
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch tasks and stats
  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, statsRes] = await Promise.all([
        fetch("/api/tasks?limit=50"),
        fetch("/api/tasks/stats"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [fetchData]);

  // Get greeting based on time
  const getGreeting = () => {
    const hour = currentTime.getHours();
    const firstName = user?.full_name?.split(" ")[0] || "";

    let greeting: string;
    if (hour < 12) greeting = "Good morning";
    else if (hour < 17) greeting = "Good afternoon";
    else greeting = "Good evening";

    return firstName ? `${greeting}, ${firstName}` : greeting;
  };

  // Filter and sort tasks - show what needs attention
  const needsAttention = tasks
    .filter(t => t.status !== "completed" && t.status !== "cancelled")
    .sort((a, b) => {
      // Sort by: overdue first, then urgent, then high, then by due date
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };

      const aOverdue = a.due_date && isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date));
      const bOverdue = b.due_date && isPast(new Date(b.due_date)) && !isToday(new Date(b.due_date));

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      const aPriority = priorityOrder[a.priority] ?? 3;
      const bPriority = priorityOrder[b.priority] ?? 3;

      if (aPriority !== bPriority) return aPriority - bPriority;

      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return a.due_date ? -1 : 1;
    })
    .slice(0, 8);

  const overdueCount = stats?.overdue || 0;
  const dueTodayCount = stats?.dueToday || 0;
  const completedTodayCount = stats?.completedToday || 0;

  if (!mounted) {
    return (
      <>
        <Header title="Dashboard" />
        <main className="p-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Dashboard" />
      <main className="p-6 max-w-5xl mx-auto">
        {/* Header with greeting and date */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground">{getGreeting()}</h1>
          <p className="text-muted-foreground mt-1" suppressHydrationWarning>
            {format(currentTime, "EEEE, MMMM d")}
          </p>
        </div>

        {/* Three key metrics - simple and clean */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <button
            onClick={() => router.push("/tasks-table?status=overdue")}
            className={cn(
              "p-4 rounded-xl text-left transition-all",
              overdueCount > 0
                ? "bg-red-50 hover:bg-red-100 border border-red-100"
                : "bg-muted/50 hover:bg-muted border border-transparent"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className={cn("h-4 w-4", overdueCount > 0 ? "text-red-600" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", overdueCount > 0 ? "text-red-600" : "text-muted-foreground")}>
                Overdue
              </span>
            </div>
            <p className={cn("text-3xl font-bold", overdueCount > 0 ? "text-red-700" : "text-foreground")}>
              {overdueCount}
            </p>
          </button>

          <button
            onClick={() => router.push("/tasks-table?status=due_today")}
            className={cn(
              "p-4 rounded-xl text-left transition-all",
              dueTodayCount > 0
                ? "bg-amber-50 hover:bg-amber-100 border border-amber-100"
                : "bg-muted/50 hover:bg-muted border border-transparent"
            )}
          >
            <div className="flex items-center gap-2 mb-1">
              <Clock className={cn("h-4 w-4", dueTodayCount > 0 ? "text-amber-600" : "text-muted-foreground")} />
              <span className={cn("text-sm font-medium", dueTodayCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
                Due Today
              </span>
            </div>
            <p className={cn("text-3xl font-bold", dueTodayCount > 0 ? "text-amber-700" : "text-foreground")}>
              {dueTodayCount}
            </p>
          </button>

          <button
            onClick={() => router.push("/tasks-table?status=completed")}
            className="p-4 rounded-xl bg-muted/50 hover:bg-muted border border-transparent text-left transition-all"
          >
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-muted-foreground">Done Today</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{completedTodayCount}</p>
          </button>
        </div>

        {/* Focus: Tasks needing attention */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-foreground">Needs Attention</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/tasks-table")}
              className="text-muted-foreground hover:text-foreground"
            >
              View all tasks
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : needsAttention.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-lg font-medium text-foreground">You're all caught up</p>
                <p className="text-sm text-muted-foreground mt-1">No urgent tasks at the moment</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {needsAttention.map((task) => {
                const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                const isDueToday = task.due_date && isToday(new Date(task.due_date));

                return (
                  <button
                    key={task.id}
                    onClick={() => router.push(`/tasks-table`)}
                    className={cn(
                      "w-full p-4 rounded-lg border text-left transition-all group",
                      "hover:border-primary/30 hover:shadow-sm",
                      isOverdue && "border-red-200 bg-red-50/50",
                      isDueToday && !isOverdue && "border-amber-200 bg-amber-50/30"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {/* Priority indicator */}
                      <div className={cn("w-1 h-full min-h-[40px] rounded-full", priorityColors[task.priority])} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-foreground truncate">{task.title}</p>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </div>

                        <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                          {task.due_date && (
                            <span className={cn(
                              "flex items-center gap-1",
                              isOverdue && "text-red-600 font-medium",
                              isDueToday && !isOverdue && "text-amber-600"
                            )}>
                              <Clock className="h-3 w-3" />
                              {isOverdue
                                ? `${formatDistanceToNow(new Date(task.due_date))} overdue`
                                : isDueToday
                                  ? "Due today"
                                  : format(new Date(task.due_date), "MMM d")
                              }
                            </span>
                          )}

                          {task.priority === "urgent" && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0">
                              Urgent
                            </Badge>
                          )}
                          {task.priority === "high" && (
                            <Badge variant="secondary" className="text-xs px-1.5 py-0 bg-orange-100 text-orange-700">
                              High
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
