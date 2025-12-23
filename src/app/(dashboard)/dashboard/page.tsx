"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/supabase/auth-context";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { Task } from "@/lib/tasks/task-context";
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
  Plus,
  Activity,
  User,
  FileText,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isToday, isPast } from "date-fns";
import { toast } from "sonner";

interface DashboardTask {
  id: string;
  title: string;
  description?: string | null;
  priority: "urgent" | "high" | "medium" | "low";
  due_date: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  client_id: string | null;
  source_type: string | null;
  assigned_to?: string | null;
  client?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
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

interface ActivityItem {
  id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_name: string | null;
  created_at: string;
}

const priorityColors = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-blue-500",
  low: "bg-slate-400",
};

const activityIcons: Record<string, React.ReactNode> = {
  task: <ListTodo className="h-3.5 w-3.5" />,
  client: <User className="h-3.5 w-3.5" />,
  email: <Mail className="h-3.5 w-3.5" />,
  call: <Phone className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  message: <MessageSquare className="h-3.5 w-3.5" />,
};

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Task detail panel state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);

  // Quick create dialog state
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium" as "urgent" | "high" | "medium" | "low",
    due_date: "",
  });

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch tasks, stats, and activity
  const fetchData = useCallback(async () => {
    try {
      const [tasksRes, statsRes, activityRes] = await Promise.all([
        fetch("/api/tasks?limit=50"),
        fetch("/api/tasks/stats"),
        fetch("/api/activity?limit=10"),
      ]);

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }

      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivities(data.activities || []);
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

  // Handle task click - open detail panel
  const handleTaskClick = (task: DashboardTask) => {
    // Convert to Task type for the panel
    const fullTask: Task = {
      id: task.id,
      title: task.title,
      description: task.description || null,
      priority: task.priority,
      due_date: task.due_date,
      status: task.status,
      client_id: task.client_id,
      assigned_to: task.assigned_to || null,
      claimed_by: null,
      created_at: "",
      updated_at: "",
      source_type: null,
      source_email_id: null,
      source_metadata: null,
      assigned_at: null,
      assigned_by: null,
      claimed_at: null,
      completed_at: null,
      action_type_id: null,
      client: task.client ? {
        id: task.client.id,
        first_name: task.client.first_name || "",
        last_name: task.client.last_name || "",
        email: task.client.email || undefined,
        phone: task.client.phone || undefined,
      } : null,
    };
    setSelectedTask(fullTask);
    setDetailPanelOpen(true);
  };

  // Handle quick create task
  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      toast.error("Title is required");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          description: newTask.description || null,
          priority: newTask.priority,
          due_date: newTask.due_date || null,
          status: "pending",
        }),
      });

      if (!res.ok) throw new Error("Failed to create task");

      toast.success("Task created");
      setCreateDialogOpen(false);
      setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
      fetchData();
    } catch (error) {
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
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

  // Get recently completed tasks
  const recentlyCompleted = tasks
    .filter(t => t.status === "completed")
    .slice(0, 5);

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

          {/* Quick Create Button */}
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="h-8 gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Quick Task
          </Button>

          <div className="h-4 border-l mx-2" />

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

              {/* Two-column layout for tasks and activity */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Tasks needing attention - takes 2 columns */}
                <Card className="border-border/50 lg:col-span-2">
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
                        onClick={() => router.push("/tasks")}
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
                              onClick={() => handleTaskClick(task)}
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

                {/* Team Activity Feed - takes 1 column */}
                <Card className="border-border/50">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between p-3 border-b">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        <h2 className="font-medium text-sm">Team Activity</h2>
                      </div>
                    </div>

                    {activities.length === 0 ? (
                      <div className="py-8 text-center">
                        <Activity className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No recent activity</p>
                      </div>
                    ) : (
                      <div className="divide-y max-h-[300px] overflow-y-auto">
                        {activities.map((activity) => (
                          <div key={activity.id} className="p-2.5 text-xs">
                            <div className="flex items-start gap-2">
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                                {activityIcons[activity.resource_type] || <Activity className="h-3.5 w-3.5" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-muted-foreground">
                                  <span className="font-medium text-foreground">
                                    {activity.user_email?.split("@")[0]}
                                  </span>
                                  {" "}
                                  {activity.action}
                                  {activity.resource_name && (
                                    <>
                                      {" "}
                                      <span className="font-medium text-foreground truncate">
                                        {activity.resource_name}
                                      </span>
                                    </>
                                  )}
                                </p>
                                <p className="text-muted-foreground/70 mt-0.5">
                                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recently Completed */}
              {recentlyCompleted.length > 0 && (
                <Card className="border-border/50">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between p-3 border-b">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <h2 className="font-medium text-sm">Recently Completed</h2>
                      </div>
                    </div>
                    <div className="p-3 flex flex-wrap gap-2">
                      {recentlyCompleted.map((task) => (
                        <button
                          key={task.id}
                          onClick={() => handleTaskClick(task)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-green-50 text-green-700 rounded-md text-xs hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span className="truncate max-w-[200px]">{task.title}</span>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

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

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask}
        open={detailPanelOpen}
        onOpenChange={setDetailPanelOpen}
        onTaskUpdate={fetchData}
      />

      {/* Quick Create Task Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Title</label>
              <Input
                placeholder="What needs to be done?"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                placeholder="Add more details..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <Select
                  value={newTask.priority}
                  onValueChange={(v) => setNewTask({ ...newTask, priority: v as typeof newTask.priority })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Due Date</label>
                <Input
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTask} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
