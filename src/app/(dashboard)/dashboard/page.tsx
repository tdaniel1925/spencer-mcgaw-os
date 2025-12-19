"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  LayoutDashboard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Loader2,
  ArrowRight,
  Bot,
  Phone,
  Mail,
  ListTodo,
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
        <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Dashboard" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="h-14 border-b bg-card flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-primary" />
            <span className="font-medium">Dashboard</span>
          </div>

          <div className="flex-1" />

          {/* Quick Stats in Top Bar */}
          <div className="flex items-center gap-4 text-sm">
            <button
              onClick={() => router.push("/tasks-table?status=overdue")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
                overdueCount > 0 && "hover:bg-red-50"
              )}
            >
              <AlertTriangle className={cn("h-4 w-4", overdueCount > 0 ? "text-red-600" : "text-muted-foreground")} />
              <span className={cn("font-medium", overdueCount > 0 ? "text-red-600" : "text-muted-foreground")}>
                {overdueCount} overdue
              </span>
            </button>
            <button
              onClick={() => router.push("/tasks-table?status=due_today")}
              className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors",
                dueTodayCount > 0 && "hover:bg-amber-50"
              )}
            >
              <Clock className={cn("h-4 w-4", dueTodayCount > 0 ? "text-amber-600" : "text-muted-foreground")} />
              <span className={cn("font-medium", dueTodayCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
                {dueTodayCount} due today
              </span>
            </button>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-muted-foreground">{completedTodayCount} done</span>
            </div>
          </div>

          <div className="h-4 border-l mx-2" />

          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            {format(currentTime, "EEEE, MMMM d")}
          </p>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4 max-w-5xl mx-auto 2xl:max-w-6xl">
              {/* Greeting Card */}
              <Card className="border-border/50">
                <CardContent className="p-4">
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
                    <div className="flex items-start gap-3">
                      <Bot className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <h1 className="text-xl font-semibold text-foreground">{getGreeting()}</h1>
                        <p className="text-sm text-muted-foreground mt-1">
                          {needsAttention.length > 0
                            ? `You have ${needsAttention.length} task${needsAttention.length > 1 ? 's' : ''} that need${needsAttention.length === 1 ? 's' : ''} attention.`
                            : "You're all caught up! No urgent tasks right now."}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Three key metrics */}
              <div className="grid grid-cols-3 gap-3">
                <Card
                  className={cn(
                    "cursor-pointer transition-all border-border/50 hover:shadow-md",
                    overdueCount > 0 && "border-red-200 bg-red-50/50"
                  )}
                  onClick={() => router.push("/tasks-table?status=overdue")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={cn("h-4 w-4", overdueCount > 0 ? "text-red-600" : "text-muted-foreground")} />
                      <span className={cn("text-[10px] font-medium uppercase tracking-wide", overdueCount > 0 ? "text-red-600" : "text-muted-foreground")}>
                        Overdue
                      </span>
                    </div>
                    <p className={cn("text-2xl font-bold", overdueCount > 0 ? "text-red-700" : "text-foreground")}>
                      {overdueCount}
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    "cursor-pointer transition-all border-border/50 hover:shadow-md",
                    dueTodayCount > 0 && "border-amber-200 bg-amber-50/50"
                  )}
                  onClick={() => router.push("/tasks-table?status=due_today")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className={cn("h-4 w-4", dueTodayCount > 0 ? "text-amber-600" : "text-muted-foreground")} />
                      <span className={cn("text-[10px] font-medium uppercase tracking-wide", dueTodayCount > 0 ? "text-amber-600" : "text-muted-foreground")}>
                        Due Today
                      </span>
                    </div>
                    <p className={cn("text-2xl font-bold", dueTodayCount > 0 ? "text-amber-700" : "text-foreground")}>
                      {dueTodayCount}
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer transition-all border-border/50 hover:shadow-md"
                  onClick={() => router.push("/tasks-table?status=completed")}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        Done Today
                      </span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{completedTodayCount}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Tasks needing attention */}
              <Card className="border-border/50">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="flex items-center gap-2">
                      <ListTodo className="h-4 w-4 text-primary" />
                      <h2 className="font-medium text-sm">Needs Attention</h2>
                      <Badge variant="secondary" className="text-[10px]">{needsAttention.length}</Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push("/tasks-table")}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      View all
                      <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </div>

                  {loading ? (
                    <div className="p-3 space-y-2">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                      ))}
                    </div>
                  ) : needsAttention.length === 0 ? (
                    <div className="py-12 text-center">
                      <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-3" />
                      <p className="font-medium text-foreground">You're all caught up</p>
                      <p className="text-sm text-muted-foreground mt-1">No urgent tasks at the moment</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {needsAttention.map((task) => {
                        const isOverdue = task.due_date && isPast(new Date(task.due_date)) && !isToday(new Date(task.due_date));
                        const isDueToday = task.due_date && isToday(new Date(task.due_date));

                        return (
                          <button
                            key={task.id}
                            onClick={() => router.push(`/tasks-table`)}
                            className={cn(
                              "w-full p-3 text-left transition-colors group hover:bg-muted/50",
                              isOverdue && "bg-red-50/30",
                              isDueToday && !isOverdue && "bg-amber-50/30"
                            )}
                          >
                            <div className="flex items-start gap-3">
                              {/* Priority indicator */}
                              <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", priorityColors[task.priority])} />

                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-sm text-foreground truncate">{task.title}</p>
                                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </div>

                                <div className="flex items-center gap-2 mt-1 text-xs">
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
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-100 text-red-700 border-red-200">
                                      Urgent
                                    </Badge>
                                  )}
                                  {task.priority === "high" && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-orange-100 text-orange-700 border-orange-200">
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
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-3">
                <Card
                  className="cursor-pointer transition-all border-border/50 hover:shadow-md hover:border-primary/30"
                  onClick={() => router.push("/calls")}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Phone className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Phone Agent</p>
                      <p className="text-xs text-muted-foreground">View calls</p>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer transition-all border-border/50 hover:shadow-md hover:border-primary/30"
                  onClick={() => router.push("/email")}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Email Kanban</p>
                      <p className="text-xs text-muted-foreground">Process emails</p>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className="cursor-pointer transition-all border-border/50 hover:shadow-md hover:border-primary/30"
                  onClick={() => router.push("/tasks")}
                >
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ListTodo className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">My Tasks</p>
                      <p className="text-xs text-muted-foreground">Kanban board</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </ScrollArea>
        </div>
      </main>
    </>
  );
}
