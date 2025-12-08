"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEmail } from "@/lib/email";
import { useCalls } from "@/lib/calls/call-context";
import { useAuth } from "@/lib/supabase/auth-context";
import {
  KPIRibbon,
  PriorityTasks,
  CompactAgenda,
  ActivityFeed,
  QuickActions,
  MiniKanban,
  RecentCalls,
  DashboardSettings,
} from "@/components/dashboard/widgets";
import {
  Sparkles,
  Settings,
  Loader2,
  Mail,
  ChevronRight,
  Circle,
  PlayCircle,
  Clock,
  CheckCircle,
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
    action_type?: {
      label: string;
      color: string;
    };
  }>;
}

// Greeting messages
const greetings = {
  morning: ["Good morning", "Rise and shine", "Morning"],
  afternoon: ["Good afternoon", "Hope your day is going well", "Afternoon"],
  evening: ["Good evening", "Evening", "Winding down"],
  monday: ["Happy Monday", "New week, new wins"],
  friday: ["Happy Friday", "TGIF", "Finish strong"],
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
    const interval = setInterval(fetchTaskStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    const dayOfWeek = currentTime.getDay();
    const dayOfYear = Math.floor(
      (currentTime.getTime() - new Date(currentTime.getFullYear(), 0, 0).getTime()) / 86400000
    );

    const firstName = user?.full_name?.split(" ")[0] || "";

    let greetingPool: string[];

    if (dayOfWeek === 1) {
      greetingPool = greetings.monday;
    } else if (dayOfWeek === 5) {
      greetingPool = greetings.friday;
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      greetingPool = greetings.weekend;
    } else if (hour < 12) {
      greetingPool = greetings.morning;
    } else if (hour < 17) {
      greetingPool = greetings.afternoon;
    } else {
      greetingPool = greetings.evening;
    }

    const greetingIndex = dayOfYear % greetingPool.length;
    const greeting = greetingPool[greetingIndex];

    return firstName ? `${greeting}, ${firstName}` : greeting;
  };

  // Calculate stats
  const totalTasks = taskStats?.total || 0;
  const pendingTasks = taskStats?.pending || 0;
  const completedToday = taskStats?.completedToday || 0;
  const overdueTasks = taskStats?.overdue || 0;
  const dueToday = taskStats?.dueToday || 0;
  const timeSavedHours = Math.round((completedToday * 15) / 60 * 10) / 10;

  // Email stats
  const unreadEmails = getUnreadCount();
  const emailTaskCount = emailTasks.length;

  // Priority tasks for widget
  const priorityTasks = taskStats?.urgentTasks?.map((task) => ({
    id: task.id,
    title: task.title,
    priority: task.priority as "urgent" | "high" | "medium" | "low",
    due_date: task.due_date,
    client_name: task.client_name,
    status: "open",
    action_type: task.action_type,
  })) || [];

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
      <main className="p-4 md:p-6 space-y-4 md:space-y-6 overflow-auto">
        {/* Header Row: Greeting + Settings */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{getGreeting()}!</h1>
            <p className="text-muted-foreground text-sm" suppressHydrationWarning>
              {format(currentTime, "EEEE, MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">AI Active</span>
            </div>
            <DashboardSettings
              trigger={
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Customize</span>
                </Button>
              }
            />
          </div>
        </div>

        {/* KPI Ribbon */}
        <KPIRibbon
          stats={{
            totalTasks,
            pendingTasks,
            overdueTasks,
            dueToday,
            completedToday,
            timeSavedHours,
          }}
          loading={loading}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
          {/* Left Column - Focus Zone (8 cols on large screens) */}
          <div className="lg:col-span-8 space-y-4 md:space-y-6">
            {/* Priority Tasks */}
            <PriorityTasks
              tasks={priorityTasks}
              loading={loading}
              maxItems={5}
            />

            {/* Quick Actions */}
            <QuickActions columns={6} />

            {/* Workflow Status (Mini Kanban) */}
            <MiniKanban
              columns={[
                { id: "open", label: "Open", count: pendingTasks, color: "bg-slate-500", icon: Circle },
                { id: "in_progress", label: "In Progress", count: taskStats?.inProgress || 0, color: "bg-blue-500", icon: PlayCircle },
                { id: "review", label: "Review", count: 0, color: "bg-amber-500", icon: Clock },
                { id: "completed", label: "Done", count: taskStats?.completed || 0, color: "bg-green-500", icon: CheckCircle },
              ]}
              loading={loading}
            />

            {/* Email Summary Card */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    Email Summary
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => router.push("/email")}
                  >
                    View All
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div
                    onClick={() => router.push("/email")}
                    className="p-4 rounded-lg bg-blue-50 border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                    <p className="text-3xl font-bold text-blue-600">{unreadEmails}</p>
                    <p className="text-sm text-muted-foreground">Unread Emails</p>
                  </div>
                  <div
                    onClick={() => router.push("/email")}
                    className="p-4 rounded-lg bg-amber-50 border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                  >
                    <p className="text-3xl font-bold text-amber-600">{emailTaskCount}</p>
                    <p className="text-sm text-muted-foreground">Email Tasks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Context Panel (4 cols on large screens) */}
          <div className="lg:col-span-4 space-y-4 md:space-y-6">
            {/* Compact Agenda */}
            <TooltipProvider>
              <CompactAgenda maxItems={4} />
            </TooltipProvider>

            {/* Recent Calls */}
            <RecentCalls calls={calls} loading={false} maxItems={3} />

            {/* Activity Feed */}
            <ActivityFeed maxItems={5} />
          </div>
        </div>
      </main>
    </>
  );
}
