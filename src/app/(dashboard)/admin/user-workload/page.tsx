"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Users,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  EyeOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UserWorkload {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  department: string | null;
  stats: {
    total_assigned: number;
    pending: number;
    in_progress: number;
    completed_today: number;
    completed_this_week: number;
    overdue: number;
    avg_completion_time_minutes: number;
    completion_rate: number;
  };
  privacy_hidden: boolean;
  recent_tasks: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    created_at: string;
  }>;
}

interface WorkloadSummary {
  total_users: number;
  total_tasks: number;
  total_pending: number;
  total_overdue: number;
  avg_tasks_per_user: number;
  busiest_user: { name: string; count: number } | null;
  least_busy_user: { name: string; count: number } | null;
}

export default function UserWorkloadPage() {
  const [workloads, setWorkloads] = useState<UserWorkload[]>([]);
  const [summary, setSummary] = useState<WorkloadSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("workload");

  const fetchWorkloads = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterRole !== "all") params.append("role", filterRole);
      if (filterDepartment !== "all") params.append("department", filterDepartment);
      params.append("sort", sortBy);

      const response = await fetch(`/api/admin/user-workload?${params}`);
      if (response.ok) {
        const data = await response.json();
        setWorkloads(data.workloads || []);
        setSummary(data.summary || null);
      }
    } catch (error) {
      console.error("Error fetching workloads:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterRole, filterDepartment, sortBy]);

  useEffect(() => {
    fetchWorkloads();
  }, [fetchWorkloads]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchWorkloads();
  };

  const toggleUserExpand = (userId: string) => {
    setExpandedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const getWorkloadLevel = (pending: number, inProgress: number): "low" | "medium" | "high" | "overloaded" => {
    const total = pending + inProgress;
    if (total <= 3) return "low";
    if (total <= 7) return "medium";
    if (total <= 12) return "high";
    return "overloaded";
  };

  const getWorkloadColor = (level: string) => {
    switch (level) {
      case "low": return "bg-green-500";
      case "medium": return "bg-yellow-500";
      case "high": return "bg-orange-500";
      case "overloaded": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getCompletionTrend = (rate: number): "up" | "down" | "stable" => {
    if (rate >= 80) return "up";
    if (rate <= 50) return "down";
    return "stable";
  };

  const formatTime = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Get unique departments for filter
  const departments = [...new Set(workloads.map((w) => w.department).filter(Boolean))];

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header title="User Workload" />
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title="User Workload" />
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">User Workload Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Monitor task distribution and team performance
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          {summary && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total_tasks}</div>
                  <p className="text-xs text-muted-foreground">
                    {summary.avg_tasks_per_user.toFixed(1)} avg per user
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pending</CardTitle>
                  <Clock className="h-4 w-4 text-yellow-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total_pending}</div>
                  <p className="text-xs text-muted-foreground">
                    Awaiting action
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overdue</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">{summary.total_overdue}</div>
                  <p className="text-xs text-muted-foreground">
                    Need attention
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary.total_users}</div>
                  <p className="text-xs text-muted-foreground">
                    With assigned tasks
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-4">
            <Select value={filterRole} onValueChange={setFilterRole}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>

            {departments.length > 0 && (
              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept} value={dept!}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workload">Highest Workload</SelectItem>
                <SelectItem value="overdue">Most Overdue</SelectItem>
                <SelectItem value="completion">Best Completion Rate</SelectItem>
                <SelectItem value="name">Name (A-Z)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Workload Table */}
          <Card>
            <CardHeader>
              <CardTitle>Team Workload</CardTitle>
              <CardDescription>
                Click on a user to see their recent tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">User</TableHead>
                    <TableHead>Workload</TableHead>
                    <TableHead className="text-center">Pending</TableHead>
                    <TableHead className="text-center">In Progress</TableHead>
                    <TableHead className="text-center">Overdue</TableHead>
                    <TableHead className="text-center">Completed (Week)</TableHead>
                    <TableHead className="text-center">Avg Time</TableHead>
                    <TableHead className="text-center">Rate</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workloads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No user workload data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    workloads.map((user) => {
                      const workloadLevel = getWorkloadLevel(
                        user.stats.pending,
                        user.stats.in_progress
                      );
                      const trend = getCompletionTrend(user.stats.completion_rate);
                      const isExpanded = expandedUsers.has(user.id);

                      return (
                        <Collapsible key={user.id} asChild>
                          <>
                            <TableRow
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleUserExpand(user.id)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <CollapsibleTrigger asChild>
                                    <Button variant="ghost" size="sm" className="p-0 h-6 w-6">
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </CollapsibleTrigger>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{user.full_name}</span>
                                      {user.privacy_hidden && (
                                        <span title="Privacy enabled">
                                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {user.role} {user.department && `• ${user.department}`}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className={cn("w-3 h-3 rounded-full", getWorkloadColor(workloadLevel))} />
                                  <span className="text-sm capitalize">{workloadLevel}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="outline">{user.stats.pending}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{user.stats.in_progress}</Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                {user.stats.overdue > 0 ? (
                                  <Badge variant="destructive">{user.stats.overdue}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                                  <span>{user.stats.completed_this_week}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm">
                                {formatTime(user.stats.avg_completion_time_minutes)}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-green-500" />}
                                  {trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
                                  {trend === "stable" && <Minus className="h-3.5 w-3.5 text-gray-500" />}
                                  <span className={cn(
                                    "text-sm font-medium",
                                    user.stats.completion_rate >= 80 && "text-green-600",
                                    user.stats.completion_rate <= 50 && "text-red-600"
                                  )}>
                                    {user.stats.completion_rate}%
                                  </span>
                                </div>
                              </TableCell>
                            </TableRow>
                            <CollapsibleContent asChild>
                              <TableRow>
                                <TableCell colSpan={8} className="bg-muted/30 p-4">
                                  <div className="space-y-2">
                                    <h4 className="font-medium text-sm">Recent Tasks</h4>
                                    {user.recent_tasks.length === 0 ? (
                                      <p className="text-sm text-muted-foreground">No recent tasks</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {user.recent_tasks.map((task) => (
                                          <div
                                            key={task.id}
                                            className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted"
                                          >
                                            <span className="text-sm truncate flex-1">{task.title}</span>
                                            <div className="flex items-center gap-2">
                                              <Badge
                                                variant={
                                                  task.priority === "urgent"
                                                    ? "destructive"
                                                    : task.priority === "high"
                                                    ? "default"
                                                    : "secondary"
                                                }
                                                className="text-[10px]"
                                              >
                                                {task.priority}
                                              </Badge>
                                              <Badge variant="outline" className="text-[10px]">
                                                {task.status}
                                              </Badge>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            </CollapsibleContent>
                          </>
                        </Collapsible>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
