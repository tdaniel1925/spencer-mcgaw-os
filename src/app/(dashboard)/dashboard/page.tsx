"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEmail } from "@/lib/email";
import { useCalls } from "@/lib/calls/call-context";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  Clock,
  CheckCircle,
  Phone,
  Mail,
  Bot,
  TrendingUp,
  AlertCircle,
  Play,
  ArrowRight,
  Zap,
  Timer,
  DollarSign,
  BarChart3,
  Headphones,
  MessageSquare,
  Sparkles,
  ExternalLink,
  ListTodo,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  completedToday: number;
  completedThisWeek: number;
  dueToday: number;
  overdue: number;
  urgentTasks: Array<{
    id: string;
    title: string;
    due_date: string;
    priority: string;
    client_name: string;
  }>;
}

const callStatusConfig = {
  handled: { label: "AI Handled", className: "bg-green-100 text-green-700" },
  needs_action: { label: "Needs Action", className: "bg-amber-100 text-amber-700" },
  transferred: { label: "Transferred", className: "bg-blue-100 text-blue-700" },
};

// Greeting messages for variety
const greetings = {
  morning: [
    "Good morning",
    "Rise and shine",
    "Morning",
    "Hope you slept well",
    "Ready to conquer the day",
  ],
  afternoon: [
    "Good afternoon",
    "Hope your day is going well",
    "Afternoon",
    "Keep up the great work",
  ],
  evening: [
    "Good evening",
    "Evening",
    "Winding down",
    "Almost done for the day",
  ],
  monday: ["Happy Monday", "New week, new wins", "Let's start the week strong"],
  friday: ["Happy Friday", "TGIF", "Almost weekend", "Finish strong"],
  weekend: ["Happy weekend", "Enjoy your weekend"],
};

export default function DashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  const { emails, emailTasks, getUnreadCount } = useEmail();
  const { calls } = useCalls();
  const { user } = useAuth();

  useEffect(() => {
    setMounted(true);
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch task stats
  useEffect(() => {
    async function fetchTaskStats() {
      try {
        const response = await fetch("/api/tasks/stats");
        if (response.ok) {
          const data = await response.json();
          setTaskStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch task stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchTaskStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTaskStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();
    const dayOfYear = Math.floor((currentTime.getTime() - new Date(currentTime.getFullYear(), 0, 0).getTime()) / 86400000);

    // Get first name from full_name
    const firstName = user?.full_name?.split(" ")[0] || "";

    let greetingPool: string[];

    // Check for special days first
    if (dayOfWeek === 1) {
      // Monday
      greetingPool = greetings.monday;
    } else if (dayOfWeek === 5) {
      // Friday
      greetingPool = greetings.friday;
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend
      greetingPool = greetings.weekend;
    } else if (hour < 12) {
      greetingPool = greetings.morning;
    } else if (hour < 17) {
      greetingPool = greetings.afternoon;
    } else {
      greetingPool = greetings.evening;
    }

    // Use day of year to pick a consistent greeting for the day
    const greetingIndex = dayOfYear % greetingPool.length;
    const greeting = greetingPool[greetingIndex];

    return firstName ? `${greeting}, ${firstName}` : greeting;
  };

  // Calculate stats from real data
  const totalTasks = taskStats?.total || 0;
  const pendingTasks = taskStats?.pending || 0;
  const completedTasks = taskStats?.completed || 0;
  const completedToday = taskStats?.completedToday || 0;
  const urgentTasks = taskStats?.overdue || 0;
  const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Email stats
  const unreadEmails = getUnreadCount();
  const emailTaskCount = emailTasks.length;

  // Call stats
  const todayCalls = calls.filter(call => {
    const callDate = new Date(call.callStartedAt);
    const today = new Date();
    return callDate.toDateString() === today.toDateString();
  });

  // Simulated time saved (based on completed tasks, 15 min per task)
  const timeSavedToday = Math.round((completedToday * 15) / 60 * 10) / 10;
  const automationRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  if (!mounted) {
    return (
      <>
        <Header title="Dashboard" />
        <main className="p-6 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Dashboard" />
      <main className="p-6 space-y-6 overflow-auto">
        {/* Greeting & Date */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{getGreeting()}!</h1>
            <p className="text-muted-foreground" suppressHydrationWarning>
              {format(currentTime, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">AI Assistant Active</span>
          </div>
        </div>

        {/* Top Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Tasks Card */}
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => router.push("/tasks")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tasks</p>
                  <p className="text-3xl font-bold mt-1">{totalTasks}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{pendingTasks}</span> pending
                  </p>
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                  <ListTodo className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">View all tasks</span>
                <ExternalLink className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>

          {/* Email Tasks Card */}
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => router.push("/email")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Email Tasks</p>
                  <p className="text-3xl font-bold mt-1">{emailTaskCount}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{unreadEmails}</span> unread emails
                  </p>
                </div>
                <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                  <Mail className="h-7 w-7 text-blue-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">View email kanban</span>
                <ExternalLink className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>

          {/* Calls Card */}
          <Card
            className="cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => router.push("/calls")}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Calls Today</p>
                  <p className="text-3xl font-bold mt-1">{todayCalls.length}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium text-foreground">{calls.length}</span> total calls
                  </p>
                </div>
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <Phone className="h-7 w-7 text-green-600" />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">View all calls</span>
                <ExternalLink className="h-3 w-3" />
              </div>
            </CardContent>
          </Card>

          {/* Completed Today Card */}
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed Today</p>
                  <p className="text-3xl font-bold mt-1">{completedToday}</p>
                  <p className="text-sm text-primary flex items-center gap-1 mt-1">
                    <TrendingUp className="h-4 w-4" />
                    ~{timeSavedToday} hrs saved
                  </p>
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
                  <CheckCircle className="h-7 w-7 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - What Needs Attention */}
          <div className="lg:col-span-2 space-y-6">
            {/* Urgent Items */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    What Needs Your Attention
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={() => router.push("/tasks")}>
                    View All Tasks
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Urgent Section */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="text-sm font-medium">
                      HIGH PRIORITY ({taskStats?.urgentTasks?.length || 0})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {loading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : taskStats?.urgentTasks && taskStats.urgentTasks.length > 0 ? (
                      taskStats.urgentTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => router.push("/tasks")}
                        >
                          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                            <AlertCircle className="h-4 w-4 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {task.client_name || "No client"}
                              {task.due_date && ` • Due ${format(new Date(task.due_date), "MMM d")}`}
                            </p>
                          </div>
                          <Button size="sm" variant="outline">
                            View
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground p-3">
                        No high priority tasks. Great job!
                      </p>
                    )}
                  </div>
                </div>

                {/* Overdue Section */}
                {(taskStats?.overdue || 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <span className="text-sm font-medium">
                        OVERDUE ({taskStats?.overdue || 0})
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push("/tasks")}
                    >
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span className="text-sm">{taskStats?.overdue} tasks are past their due date</span>
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </div>
                  </div>
                )}

                {/* Due Today Section */}
                {(taskStats?.dueToday || 0) > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium">
                        DUE TODAY ({taskStats?.dueToday || 0})
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => router.push("/tasks")}
                    >
                      <Timer className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{taskStats?.dueToday} tasks due today</span>
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Task Progress */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Task Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Overall Progress</span>
                      <span className="font-medium">{taskProgress}% complete</span>
                    </div>
                    <Progress value={taskProgress} className="h-3" />
                  </div>

                  <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-amber-600">{pendingTasks}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{taskStats?.inProgress || 0}</p>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{completedTasks}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Calls */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Headphones className="h-5 w-5" />
                    Recent Calls
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    {todayCalls.length} today
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[280px]">
                  <div className="p-4 space-y-3">
                    {calls.length > 0 ? (
                      calls.slice(0, 5).map((call) => (
                        <div
                          key={call.id}
                          className="p-3 border rounded-lg space-y-2 cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push("/calls")}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-primary" />
                              <div>
                                <p className="font-medium text-sm">{call.callerName || "Unknown Caller"}</p>
                                <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                  {format(new Date(call.callStartedAt), "MMM d, h:mm a")}
                                </p>
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={cn("text-xs",
                                call.status === "new" ? "bg-blue-100 text-blue-700" :
                                call.status === "action_required" ? "bg-amber-100 text-amber-700" :
                                call.status === "archived" ? "bg-green-100 text-green-700" :
                                "bg-slate-100 text-slate-700"
                              )}
                            >
                              {call.status.replace(/_/g, " ")}
                            </Badge>
                          </div>
                          {call.aiAnalysis?.summary && (
                            <p className="text-sm text-muted-foreground line-clamp-2">{call.aiAnalysis.summary}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No calls yet</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
                {calls.length > 0 && (
                  <div className="p-3 border-t">
                    <Button
                      variant="ghost"
                      className="w-full"
                      size="sm"
                      onClick={() => router.push("/calls")}
                    >
                      View All Calls
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push("/tasks")}
                  >
                    <ListTodo className="h-4 w-4 mr-2" />
                    Add New Task
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push("/email")}
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Check Email Tasks
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push("/clients")}
                  >
                    <Bot className="h-4 w-4 mr-2" />
                    View Clients
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push("/analytics")}
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Analytics
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </>
  );
}
