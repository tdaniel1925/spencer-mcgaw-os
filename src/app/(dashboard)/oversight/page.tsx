"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Phone,
  Mail,
  ListTodo,
  Users,
  Loader2,
  RefreshCw,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
  Activity,
  BarChart3,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, subDays } from "date-fns";
import { useAuth } from "@/lib/supabase/auth-context";
import { useRouter } from "next/navigation";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  isOnline: boolean;
  taskCount: number;
  completedToday: number;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

interface FeedItem {
  id: string;
  type: "call" | "email" | "task";
  title: string;
  description: string | null;
  timestamp: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  client: string | null;
}

interface DashboardStats {
  totalCalls: number;
  totalEmails: number;
  totalTasks: number;
  pendingTasks: number;
  completedToday: number;
  avgResponseTime: string;
}

export default function OversightPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    completed: 0,
    overdue: 0,
  });
  const [recentActivity, setRecentActivity] = useState<FeedItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    totalEmails: 0,
    totalTasks: 0,
    pendingTasks: 0,
    completedToday: 0,
    avgResponseTime: "N/A",
  });

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Fetch oversight data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch team members with task counts
      const [teamRes, tasksRes, activityRes] = await Promise.all([
        fetch("/api/admin/team-overview"),
        fetch("/api/tasks?status=all&limit=1000"),
        fetch("/api/org-feed?limit=20"),
      ]);

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeamMembers(teamData.members || []);
      }

      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        const tasks = tasksData.tasks || [];

        const now = new Date();
        const todayStart = new Date(now.setHours(0, 0, 0, 0));

        setTaskStats({
          total: tasks.length,
          pending: tasks.filter((t: { status: string }) => t.status === "pending").length,
          inProgress: tasks.filter((t: { status: string }) => t.status === "in_progress").length,
          completed: tasks.filter((t: { status: string }) => t.status === "completed").length,
          overdue: tasks.filter((t: { status: string; due_date: string }) =>
            t.status !== "completed" && t.due_date && new Date(t.due_date) < now
          ).length,
        });

        const completedToday = tasks.filter((t: { status: string; completed_at: string }) =>
          t.status === "completed" && t.completed_at && new Date(t.completed_at) >= todayStart
        ).length;

        setStats(prev => ({
          ...prev,
          totalTasks: tasks.length,
          pendingTasks: tasks.filter((t: { status: string }) => t.status !== "completed").length,
          completedToday,
        }));
      }

      if (activityRes.ok) {
        const activityData = await activityRes.json();
        const items = (activityData.items || []).map((item: {
          id: string;
          type: string;
          timestamp: string;
          summary: string | null;
          from: { name: string | null };
          priority: string;
          hasTask: boolean;
          matchedClientName: string | null;
          emailData?: { subject: string };
        }) => ({
          id: item.id,
          type: item.type,
          title: item.type === "call"
            ? `Call from ${item.from.name || "Unknown"}`
            : item.emailData?.subject || "Email",
          description: item.summary,
          timestamp: item.timestamp,
          status: item.hasTask ? "processed" : "pending",
          priority: item.priority,
          assignedTo: null,
          client: item.matchedClientName,
        }));
        setRecentActivity(items);

        // Update stats
        const callCount = (activityData.items || []).filter((i: { type: string }) => i.type === "call").length;
        const emailCount = (activityData.items || []).filter((i: { type: string }) => i.type === "email").length;
        setStats(prev => ({
          ...prev,
          totalCalls: callCount,
          totalEmails: emailCount,
        }));
      }
    } catch (error) {
      console.error("Error fetching oversight data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (user?.role !== "admin") {
    return (
      <>
        <Header title="Oversight" />
        <main className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-lg font-medium">Admin Access Required</h2>
            <p className="text-sm text-muted-foreground">
              This page is only accessible to administrators.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Oversight" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 overflow-y-auto">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalCalls}</p>
                      <p className="text-xs text-muted-foreground">Recent Calls</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.totalEmails}</p>
                      <p className="text-xs text-muted-foreground">Recent Emails</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                      <ListTodo className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{taskStats.pending}</p>
                      <p className="text-xs text-muted-foreground">Pending Tasks</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{taskStats.inProgress}</p>
                      <p className="text-xs text-muted-foreground">In Progress</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{stats.completedToday}</p>
                      <p className="text-xs text-muted-foreground">Completed Today</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{taskStats.overdue}</p>
                      <p className="text-xs text-muted-foreground">Overdue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Team Workload */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Team Workload
                    </CardTitle>
                    <Button variant="ghost" size="sm" onClick={fetchData}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {teamMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No team members found
                    </p>
                  ) : (
                    teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-3">
                        <div className="relative">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10">
                              {member.name.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div className={cn(
                            "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white",
                            member.isOnline ? "bg-green-500" : "bg-gray-300"
                          )} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground">{member.role}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">{member.taskCount}</p>
                          <p className="text-xs text-muted-foreground">tasks</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Task Distribution */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    Task Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Pending</span>
                      <span className="font-medium">{taskStats.pending}</span>
                    </div>
                    <Progress
                      value={taskStats.total > 0 ? (taskStats.pending / taskStats.total) * 100 : 0}
                      className="h-2"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>In Progress</span>
                      <span className="font-medium">{taskStats.inProgress}</span>
                    </div>
                    <Progress
                      value={taskStats.total > 0 ? (taskStats.inProgress / taskStats.total) * 100 : 0}
                      className="h-2 [&>div]:bg-blue-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Completed</span>
                      <span className="font-medium">{taskStats.completed}</span>
                    </div>
                    <Progress
                      value={taskStats.total > 0 ? (taskStats.completed / taskStats.total) * 100 : 0}
                      className="h-2 [&>div]:bg-green-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-red-600">Overdue</span>
                      <span className="font-medium text-red-600">{taskStats.overdue}</span>
                    </div>
                    <Progress
                      value={taskStats.total > 0 ? (taskStats.overdue / taskStats.total) * 100 : 0}
                      className="h-2 [&>div]:bg-red-500"
                    />
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Tasks</span>
                      <span className="text-lg font-bold">{taskStats.total}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[280px]">
                    <div className="space-y-3">
                      {recentActivity.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No recent activity
                        </p>
                      ) : (
                        recentActivity.map((item) => (
                          <div key={item.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                              item.type === "call" ? "bg-blue-100" : "bg-purple-100"
                            )}>
                              {item.type === "call" ? (
                                <Phone className="h-4 w-4 text-blue-600" />
                              ) : (
                                <Mail className="h-4 w-4 text-purple-600" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.title}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {item.client && (
                                  <Badge variant="outline" className="text-[10px] gap-1">
                                    <Building2 className="h-2.5 w-2.5" />
                                    {item.client}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                item.status === "processed"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-amber-100 text-amber-700"
                              )}
                            >
                              {item.status === "processed" ? "Processed" : "Pending"}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>

            {/* Quick Links to Admin Tools */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Admin Tools</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <a href="/admin/users">
                      <Users className="h-5 w-5" />
                      <span className="text-sm">Manage Users</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <a href="/admin/user-workload">
                      <BarChart3 className="h-5 w-5" />
                      <span className="text-sm">User Workload</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <a href="/admin/ai-learning">
                      <TrendingUp className="h-5 w-5" />
                      <span className="text-sm">AI Learning</span>
                    </a>
                  </Button>
                  <Button variant="outline" className="h-auto py-4 flex-col gap-2" asChild>
                    <a href="/admin/audit">
                      <Activity className="h-5 w-5" />
                      <span className="text-sm">Audit Log</span>
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </>
  );
}
