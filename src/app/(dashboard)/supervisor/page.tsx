"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRightLeft,
  TrendingUp,
  Loader2,
  ListTodo,
  Target,
  Calendar,
  BarChart3,
} from "lucide-react";
import { useAuth } from "@/lib/supabase/auth-context";
import { format, subDays, startOfWeek, endOfWeek } from "date-fns";

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  role: string | null;
  stats: {
    total_assigned: number;
    completed_this_week: number;
    in_progress: number;
    overdue: number;
    pending_handoffs: number;
  };
}

interface TaskSummary {
  total: number;
  open: number;
  in_progress: number;
  completed: number;
  overdue: number;
  by_priority: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  by_action_type: {
    action_type_id: string;
    label: string;
    color: string;
    count: number;
  }[];
}

interface RecentActivity {
  id: string;
  action: string;
  details: Record<string, any>;
  task_title: string;
  performed_by_name: string;
  created_at: string;
}

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [dateRange, setDateRange] = useState("week");
  const [selectedMember, setSelectedMember] = useState<string>("all");

  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      // Load team members with stats
      const usersRes = await fetch("/api/users");
      if (usersRes.ok) {
        const usersData = await usersRes.json();

        // For each user, get their task stats
        const membersWithStats = await Promise.all(
          (usersData.users || []).map(async (u: any) => {
            const tasksRes = await fetch(`/api/taskpool/tasks?assigned_to=${u.id}&include_counts=true`);
            const tasks = tasksRes.ok ? await tasksRes.json() : { tasks: [] };

            const now = new Date();
            const weekStart = startOfWeek(now);

            return {
              ...u,
              stats: {
                total_assigned: tasks.tasks?.length || 0,
                completed_this_week: tasks.tasks?.filter(
                  (t: any) => t.status === "completed" && new Date(t.completed_at) >= weekStart
                ).length || 0,
                in_progress: tasks.tasks?.filter((t: any) => t.status === "in_progress").length || 0,
                overdue: tasks.tasks?.filter(
                  (t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "completed"
                ).length || 0,
                pending_handoffs: tasks.tasks?.filter((t: any) => t.handoff_to === u.id).length || 0,
              },
            };
          })
        );

        setTeamMembers(membersWithStats);
      }

      // Load overall task summary
      const tasksRes = await fetch("/api/taskpool/tasks");
      if (tasksRes.ok) {
        const tasksData = await tasksRes.json();
        const tasks = tasksData.tasks || [];
        const now = new Date();

        // Group by action type
        const byActionType: Record<string, { count: number; label: string; color: string }> = {};
        tasks.forEach((t: any) => {
          const typeId = t.action_type_id;
          if (!byActionType[typeId]) {
            byActionType[typeId] = {
              count: 0,
              label: t.action_type?.label || "Unknown",
              color: t.action_type?.color || "#666",
            };
          }
          byActionType[typeId].count++;
        });

        setTaskSummary({
          total: tasks.length,
          open: tasks.filter((t: any) => t.status === "open").length,
          in_progress: tasks.filter((t: any) => t.status === "in_progress").length,
          completed: tasks.filter((t: any) => t.status === "completed").length,
          overdue: tasks.filter(
            (t: any) => t.due_date && new Date(t.due_date) < now && t.status !== "completed"
          ).length,
          by_priority: {
            urgent: tasks.filter((t: any) => t.priority === "urgent").length,
            high: tasks.filter((t: any) => t.priority === "high").length,
            medium: tasks.filter((t: any) => t.priority === "medium").length,
            low: tasks.filter((t: any) => t.priority === "low").length,
          },
          by_action_type: Object.entries(byActionType).map(([id, data]) => ({
            action_type_id: id,
            ...data,
          })),
        });
      }

      // Load recent activity
      const activityRes = await fetch("/api/activity?limit=20");
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        setRecentActivity(activityData.activity || []);
      }
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getWorkloadStatus = (member: TeamMember) => {
    const total = member.stats.total_assigned;
    if (total === 0) return { label: "Available", color: "text-green-600", bg: "bg-green-100" };
    if (member.stats.overdue > 0) return { label: "Overdue Tasks", color: "text-red-600", bg: "bg-red-100" };
    if (total > 10) return { label: "Heavy Load", color: "text-orange-600", bg: "bg-orange-100" };
    if (total > 5) return { label: "Moderate", color: "text-yellow-600", bg: "bg-yellow-100" };
    return { label: "Light Load", color: "text-green-600", bg: "bg-green-100" };
  };

  if (loading) {
    return (
      <>
        <Header title="Supervisor Dashboard" />
        <main className="p-6 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading dashboard...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header title="Supervisor Dashboard" />
      <main className="p-6 space-y-6">
        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{teamMembers.length}</div>
              <p className="text-xs text-muted-foreground">
                {teamMembers.filter(m => m.stats.total_assigned > 0).length} with active tasks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
              <ListTodo className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{taskSummary?.total || 0}</div>
              <p className="text-xs text-muted-foreground">
                {taskSummary?.in_progress || 0} in progress
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{taskSummary?.overdue || 0}</div>
              <p className="text-xs text-muted-foreground">
                Requires attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{taskSummary?.completed || 0}</div>
              <p className="text-xs text-muted-foreground">
                This period
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="team" className="space-y-4">
          <TabsList>
            <TabsTrigger value="team">Team Overview</TabsTrigger>
            <TabsTrigger value="tasks">Task Distribution</TabsTrigger>
            <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          </TabsList>

          {/* Team Overview */}
          <TabsContent value="team" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Team Workload</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Team Member</TableHead>
                      <TableHead className="text-center">Assigned</TableHead>
                      <TableHead className="text-center">In Progress</TableHead>
                      <TableHead className="text-center">Completed (Week)</TableHead>
                      <TableHead className="text-center">Overdue</TableHead>
                      <TableHead className="text-center">Pending Handoffs</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teamMembers.map((member) => {
                      const status = getWorkloadStatus(member);
                      return (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={member.avatar_url || undefined} />
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.full_name, member.email)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium text-sm">
                                  {member.full_name || member.email}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {member.role || "Staff"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="font-medium">{member.stats.total_assigned}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{member.stats.in_progress}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-green-600 font-medium">
                              {member.stats.completed_this_week}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {member.stats.overdue > 0 ? (
                              <Badge variant="destructive">{member.stats.overdue}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {member.stats.pending_handoffs > 0 ? (
                              <Badge variant="outline" className="border-orange-300 text-orange-600">
                                {member.stats.pending_handoffs}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${status.color} ${status.bg} border-0`}>
                              {status.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Task Distribution */}
          <TabsContent value="tasks" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* By Priority */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tasks by Priority</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { key: "urgent", label: "Urgent", color: "bg-red-500" },
                      { key: "high", label: "High", color: "bg-orange-500" },
                      { key: "medium", label: "Medium", color: "bg-yellow-500" },
                      { key: "low", label: "Low", color: "bg-green-500" },
                    ].map((priority) => {
                      const count = taskSummary?.by_priority[priority.key as keyof typeof taskSummary.by_priority] || 0;
                      const total = taskSummary?.total || 1;
                      const percentage = Math.round((count / total) * 100);
                      return (
                        <div key={priority.key} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${priority.color}`} />
                              <span>{priority.label}</span>
                            </div>
                            <span className="font-medium">{count}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* By Action Type */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tasks by Category</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {taskSummary?.by_action_type.map((actionType) => {
                      const total = taskSummary?.total || 1;
                      const percentage = Math.round((actionType.count / total) * 100);
                      return (
                        <div key={actionType.action_type_id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: actionType.color }}
                              />
                              <span>{actionType.label}</span>
                            </div>
                            <span className="font-medium">{actionType.count}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Task Status Overview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600">{taskSummary?.open || 0}</div>
                    <p className="text-sm text-muted-foreground">Open</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-3xl font-bold text-yellow-600">{taskSummary?.in_progress || 0}</div>
                    <p className="text-sm text-muted-foreground">In Progress</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-3xl font-bold text-green-600">{taskSummary?.completed || 0}</div>
                    <p className="text-sm text-muted-foreground">Completed</p>
                  </div>
                  <div className="text-center p-4 bg-muted/50 rounded-lg">
                    <div className="text-3xl font-bold text-red-600">{taskSummary?.overdue || 0}</div>
                    <p className="text-sm text-muted-foreground">Overdue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Activity */}
          <TabsContent value="activity" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Team Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {recentActivity.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No recent activity
                  </p>
                ) : (
                  <div className="space-y-4">
                    {recentActivity.map((activity) => (
                      <div
                        key={activity.id}
                        className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0"
                      >
                        <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                        <div className="flex-1">
                          <p className="text-sm">
                            <span className="font-medium">{activity.performed_by_name}</span>
                            {" "}
                            <span className="text-muted-foreground">
                              {activity.action.replace(/_/g, " ")}
                            </span>
                            {activity.task_title && (
                              <>
                                {" "}
                                <span className="font-medium">{activity.task_title}</span>
                              </>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(activity.created_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
