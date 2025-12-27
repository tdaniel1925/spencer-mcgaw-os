"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  Search,
  Eye,
  MoreHorizontal,
  Phone,
  Mail,
  FileText,
  Loader2,
  RefreshCw,
  Users,
  User,
  UserCheck,
  Filter,
  LayoutGrid,
  List,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";
import { toast } from "sonner";
import { useAuth } from "@/lib/supabase/auth-context";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { useRouter } from "next/navigation";

// Import Task type from context for TaskDetailPanel compatibility
import { Task as ContextTask } from "@/lib/tasks/task-context";

// Types - local task type for this page
interface TeamTask {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  source_type: "phone_call" | "email" | "document_intake" | "manual" | string | null;
  source_email_id?: string | null;
  source_metadata?: Record<string, unknown> | null;
  client_id?: string | null;
  assigned_to: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  claimed_by: string | null;
  claimed_at?: string | null;
  due_date: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string;
  action_type_id?: string | null;
  client?: {
    id: string;
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
  } | null;
  assignee?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url?: string;
  } | null;
  action_type?: {
    id: string;
    code: string;
    label: string;
    color: string;
    icon: string;
  } | null;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url?: string;
  task_count?: number;
  completed_today?: number;
  overdue_count?: number;
}

// Config
const statusConfig = {
  pending: {
    label: "To Do",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-400",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700 border-blue-200",
    dot: "bg-blue-400",
  },
  completed: {
    label: "Done",
    className: "bg-green-100 text-green-700 border-green-200",
    dot: "bg-green-400",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-700 border-gray-200",
    dot: "bg-gray-400",
  },
};

const priorityConfig = {
  low: { label: "Low", className: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-600", dot: "bg-blue-400" },
  high: { label: "High", className: "bg-orange-100 text-orange-600", dot: "bg-orange-400" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-600", dot: "bg-red-400" },
};

const sourceIcons = {
  phone_call: Phone,
  email: Mail,
  document_intake: FileText,
  manual: ClipboardList,
};

export default function TeamTasksPage() {
  const { user, isManager, isAdmin } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active"); // active, all, completed
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // View mode
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Task detail
  const [selectedTask, setSelectedTask] = useState<TeamTask | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Check if user has access
  useEffect(() => {
    if (!isManager && !isAdmin) {
      toast.error("You don't have permission to view team tasks");
      router.push("/tasks");
    }
  }, [isManager, isAdmin, router]);

  // Fetch all team tasks
  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("limit", "500");
      params.set("include_assignee", "true");

      const response = await fetch(`/api/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        // Filter to only assigned tasks (not org pool tasks)
        const assignedTasks = (data.tasks || []).filter(
          (t: TeamTask) => t.assigned_to || t.claimed_by
        );
        setTasks(assignedTasks);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load team tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      setLoadingMembers(true);
      const response = await fetch("/api/users/team");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchTeamMembers();
  }, [fetchTasks, fetchTeamMembers]);

  // Calculate member stats
  const getMemberStats = useCallback((memberId: string) => {
    const memberTasks = tasks.filter(
      t => t.assigned_to === memberId || t.claimed_by === memberId
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      total: memberTasks.length,
      active: memberTasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length,
      completed: memberTasks.filter(t => t.status === "completed").length,
      overdue: memberTasks.filter(t =>
        t.due_date &&
        isBefore(new Date(t.due_date), new Date()) &&
        t.status !== "completed"
      ).length,
      completedToday: memberTasks.filter(t =>
        t.status === "completed" &&
        t.created_at &&
        isAfter(new Date(t.created_at), today)
      ).length,
    };
  }, [tasks]);

  // Filter tasks
  const filteredTasks = tasks.filter((task) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.client?.first_name?.toLowerCase().includes(query) ||
        task.client?.last_name?.toLowerCase().includes(query) ||
        task.assignee?.full_name?.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Member filter
    if (selectedMember !== "all") {
      if (task.assigned_to !== selectedMember && task.claimed_by !== selectedMember) {
        return false;
      }
    }

    // Status filter
    if (statusFilter === "active") {
      if (task.status === "completed" || task.status === "cancelled") return false;
    } else if (statusFilter === "completed") {
      if (task.status !== "completed") return false;
    }

    // Priority filter
    if (priorityFilter !== "all" && task.priority !== priorityFilter) {
      return false;
    }

    return true;
  });

  // Group tasks by assignee
  const tasksByMember = teamMembers.reduce((acc, member) => {
    acc[member.id] = filteredTasks.filter(
      t => t.assigned_to === member.id || t.claimed_by === member.id
    );
    return acc;
  }, {} as Record<string, TeamTask[]>);

  // Get initials for avatar
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
    }
    return email.charAt(0).toUpperCase();
  };

  // Summary stats
  const totalActive = tasks.filter(t => t.status !== "completed" && t.status !== "cancelled").length;
  const totalOverdue = tasks.filter(t =>
    t.due_date &&
    isBefore(new Date(t.due_date), new Date()) &&
    t.status !== "completed"
  ).length;
  const totalUrgent = tasks.filter(t => t.priority === "urgent" && t.status !== "completed").length;

  if (!isManager && !isAdmin) {
    return null;
  }

  return (
    <>
      <Header title="Team Tasks" />
      <main className="flex flex-col h-[calc(100vh-64px)] overflow-hidden">
        {/* Top Bar */}
        <div className="border-b bg-card flex-shrink-0">
          <div className="p-4 space-y-4">
            {/* Header with stats */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <div>
                  <h2 className="font-semibold">Team Overview</h2>
                  <p className="text-xs text-muted-foreground">
                    View all team members' assigned tasks
                  </p>
                </div>
              </div>

              {/* Quick stats */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">{totalActive}</div>
                  <div className="text-xs text-muted-foreground">Active Tasks</div>
                </div>
                {totalOverdue > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{totalOverdue}</div>
                    <div className="text-xs text-muted-foreground">Overdue</div>
                  </div>
                )}
                {totalUrgent > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{totalUrgent}</div>
                    <div className="text-xs text-muted-foreground">Urgent</div>
                  </div>
                )}
              </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search tasks or team members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* Team member filter */}
              <Select value={selectedMember} onValueChange={setSelectedMember}>
                <SelectTrigger className="w-[180px] h-9">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Members" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Members</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[130px] h-9">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1" />

              {/* View toggle */}
              <div className="flex items-center gap-1 border rounded-lg p-1">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>

              {/* Refresh */}
              <Button variant="outline" size="sm" className="h-9" onClick={fetchTasks}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {loading || loadingMembers ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader className="pb-3">
                      <Skeleton className="h-12 w-full" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : viewMode === "grid" ? (
              /* Grid View - Grouped by Team Member */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamMembers.map((member) => {
                  const memberTasks = tasksByMember[member.id] || [];
                  const stats = getMemberStats(member.id);

                  if (selectedMember !== "all" && selectedMember !== member.id) {
                    return null;
                  }

                  return (
                    <Card key={member.id} className="flex flex-col">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={member.avatar_url} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {getInitials(member.full_name, member.email)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium truncate">
                              {member.full_name || member.email}
                            </CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {member.role}
                              </Badge>
                              {stats.overdue > 0 && (
                                <Badge variant="destructive" className="text-[10px]">
                                  {stats.overdue} overdue
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold">{stats.active}</div>
                            <div className="text-[10px] text-muted-foreground">active</div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 pt-0">
                        {memberTasks.length === 0 ? (
                          <div className="text-center py-6 text-sm text-muted-foreground">
                            No tasks assigned
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                            {memberTasks.slice(0, 5).map((task) => (
                              <TaskCard
                                key={task.id}
                                task={task}
                                onClick={() => {
                                  setSelectedTask(task);
                                  setDetailOpen(true);
                                }}
                                compact
                              />
                            ))}
                            {memberTasks.length > 5 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => setSelectedMember(member.id)}
                              >
                                View all {memberTasks.length} tasks
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              /* List View - All Tasks */
              <div className="space-y-2">
                {filteredTasks.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium">No tasks found</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Try adjusting your filters
                    </p>
                  </div>
                ) : (
                  filteredTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => {
                        setSelectedTask(task);
                        setDetailOpen(true);
                      }}
                      showAssignee
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Task Detail Panel */}
      <TaskDetailPanel
        task={selectedTask as ContextTask | null}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onTaskUpdate={fetchTasks}
      />
    </>
  );
}

// Task Card Component
function TaskCard({
  task,
  onClick,
  compact = false,
  showAssignee = false,
}: {
  task: TeamTask;
  onClick: () => void;
  compact?: boolean;
  showAssignee?: boolean;
}) {
  const SourceIcon = sourceIcons[task.source_type as keyof typeof sourceIcons] || ClipboardList;
  const isOverdue = task.due_date && isBefore(new Date(task.due_date), new Date()) && task.status !== "completed";

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border rounded-lg transition-all hover:shadow-md cursor-pointer",
        compact ? "p-2" : "p-3",
        isOverdue && "border-red-200 bg-red-50/50"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Priority dot */}
        <div
          className={cn(
            "w-2 h-2 rounded-full mt-1.5 flex-shrink-0",
            priorityConfig[task.priority]?.dot
          )}
        />

        <div className="flex-1 min-w-0">
          {/* Title */}
          <div className="font-medium text-sm truncate">{task.title}</div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {/* Status badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                statusConfig[task.status]?.className
              )}
            >
              {statusConfig[task.status]?.label}
            </Badge>

            {/* Client name */}
            {task.client && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">
                {task.client.first_name} {task.client.last_name}
              </span>
            )}

            {/* Due date */}
            {task.due_date && (
              <span className={cn(
                "text-[11px] flex items-center gap-1",
                isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"
              )}>
                <Clock className="h-3 w-3" />
                {format(new Date(task.due_date), "MMM d")}
              </span>
            )}
          </div>

          {/* Assignee (for list view) */}
          {showAssignee && task.assignee && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t">
              <Avatar className="h-5 w-5">
                <AvatarImage src={task.assignee.avatar_url} />
                <AvatarFallback className="text-[10px] bg-primary text-primary-foreground">
                  {task.assignee.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) || task.assignee.email.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                {task.assignee.full_name || task.assignee.email}
              </span>
            </div>
          )}
        </div>

        {/* Priority badge for urgent/high */}
        {(task.priority === "urgent" || task.priority === "high") && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0 flex-shrink-0",
              priorityConfig[task.priority]?.className
            )}
          >
            {task.priority === "urgent" ? "!" : "High"}
          </Badge>
        )}
      </div>
    </div>
  );
}
