"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Layers,
  Plus,
  Search,
  Filter,
  User,
  Clock,
  AlertTriangle,
  RefreshCw,
  MessageSquare,
  FileText,
  Eye,
  HelpCircle,
  Send,
  Calendar,
  Settings,
  GripVertical,
  ChevronRight,
  MoreHorizontal,
  UserPlus,
  Maximize2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TaskDetailModal } from "./task-detail-modal";
import { CreateTaskDialog } from "./create-task-dialog";
import { SuggestedTasks } from "./suggested-tasks";

interface ActionType {
  id: string;
  code: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
}

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  company: string | null;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  action_type_id: string;
  client_id: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  alert_threshold_hours: number | null;
  alert_dismissed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  created_at: string;
  ai_confidence: number | null;
  ai_extracted_data: Record<string, any>;
  source_type: string;
  action_type: ActionType | null;
  client: Client | null;
  notes: { count: number }[];
  activity: { count: number }[];
  // Handoff fields
  handoff_to: string | null;
  handoff_from: string | null;
  handoff_notes: string | null;
  handoff_at: string | null;
}

const iconMap: Record<string, React.ElementType> = {
  "message-square": MessageSquare,
  "file-text": FileText,
  eye: Eye,
  "help-circle": HelpCircle,
  send: Send,
  calendar: Calendar,
  settings: Settings,
  clipboard: FileText,
};

const priorityColors: Record<string, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

const priorityDotColors: Record<string, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
};

const priorityBorderColors: Record<string, string> = {
  urgent: "border-l-red-400",
  high: "border-l-orange-400",
  medium: "border-l-yellow-400",
  low: "border-l-green-400",
};

export default function TaskPoolPage() {
  const router = useRouter();
  const [actionTypes, setActionTypes] = useState<ActionType[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [currentView, setCurrentView] = useState<string>("pool");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [suggestionCount, setSuggestionCount] = useState(0);

  const loadActionTypes = useCallback(async () => {
    try {
      const response = await fetch("/api/taskpool/action-types");
      if (response.ok) {
        const data = await response.json();
        setActionTypes(data.actionTypes || []);
      }
    } catch (error) {
      console.error("Error loading action types:", error);
    }
  }, []);

  const loadTasks = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const params = new URLSearchParams({ view: currentView });
      if (priorityFilter !== "all") {
        params.append("priority", priorityFilter);
      }

      const response = await fetch(`/api/taskpool/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks || []);
      }
    } catch (error) {
      console.error("Error loading tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentView, priorityFilter]);

  useEffect(() => {
    loadActionTypes();
  }, [loadActionTypes]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleClaimTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/claim`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success("Task claimed successfully");
        loadTasks(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to claim task");
      }
    } catch (error) {
      console.error("Error claiming task:", error);
      toast.error("Failed to claim task");
    }
  };

  const handleReleaseTask = async (taskId: string) => {
    try {
      const response = await fetch(`/api/taskpool/tasks/${taskId}/claim`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Task released");
        loadTasks(false);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to release task");
      }
    } catch (error) {
      console.error("Error releasing task:", error);
      toast.error("Failed to release task");
    }
  };

  // Group tasks by action type
  const tasksByActionType = actionTypes.reduce(
    (acc, actionType) => {
      acc[actionType.id] = tasks.filter(
        (task) => task.action_type_id === actionType.id
      );
      return acc;
    },
    {} as Record<string, Task[]>
  );

  // Filter tasks by search query
  const filterTasks = (taskList: Task[]) => {
    if (!searchQuery) return taskList;
    const query = searchQuery.toLowerCase();
    return taskList.filter(
      (task) =>
        task.title.toLowerCase().includes(query) ||
        task.description?.toLowerCase().includes(query) ||
        task.client?.first_name?.toLowerCase().includes(query) ||
        task.client?.last_name?.toLowerCase().includes(query) ||
        task.client?.company?.toLowerCase().includes(query)
    );
  };

  const getActionIcon = (iconName: string) => {
    const Icon = iconMap[iconName] || FileText;
    return Icon;
  };

  const renderTaskCard = (task: Task) => {
    const Icon = task.action_type ? getActionIcon(task.action_type.icon) : FileText;
    const isOverdue = task.due_date && new Date(task.due_date) < new Date();
    const createdDate = new Date(task.created_at);
    const isRecent = (Date.now() - createdDate.getTime()) < 24 * 60 * 60 * 1000; // Less than 24 hours

    return (
      <div
        key={task.id}
        className={cn(
          "bg-background rounded-lg border cursor-pointer transition-all duration-200",
          "hover:shadow-md hover:border-border/80 hover:-translate-y-0.5",
          "group relative overflow-hidden"
        )}
        onClick={() => setSelectedTask(task)}
      >
        {/* Priority indicator strip */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1",
            priorityDotColors[task.priority] || "bg-gray-300"
          )}
        />

        <div className="p-3.5 pl-4">
          {/* Header row with badges and actions */}
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge
                variant="secondary"
                className={cn(
                  "text-[10px] px-2 py-0.5 font-medium capitalize",
                  priorityColors[task.priority]
                )}
              >
                {task.priority}
              </Badge>
              {isRecent && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 border-blue-200 font-medium"
                >
                  New
                </Badge>
              )}
              {task.source_type === "email" && (
                <Badge
                  variant="outline"
                  className="text-[10px] px-2 py-0.5 bg-purple-50 text-purple-600 border-purple-200 font-medium"
                >
                  Email
                </Badge>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity -mr-1.5 -mt-1"
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedTask(task); }}>
                  View Details
                </DropdownMenuItem>
                {currentView === "pool" && !task.claimed_by && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleClaimTask(task.id); }}>
                    Claim Task
                  </DropdownMenuItem>
                )}
                {task.claimed_by && currentView === "my_claimed" && (
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleReleaseTask(task.id); }}>
                    Release Task
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Title */}
          <h4 className="text-sm font-semibold leading-snug text-foreground mb-1.5">
            {task.title}
          </h4>

          {/* Description preview */}
          {task.description && (
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">
              {task.description}
            </p>
          )}

          {/* Client info if available */}
          {task.client && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-muted">
                <User className="h-3 w-3" />
              </div>
              <span className="font-medium text-foreground/80">
                {task.client.first_name} {task.client.last_name}
              </span>
              {task.client.company && (
                <span className="text-muted-foreground/60">• {task.client.company}</span>
              )}
            </div>
          )}

          {/* Footer with metadata */}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2.5 mt-2 border-t border-border/50">
            <div className="flex items-center gap-3">
              {task.due_date && (
                <span className={cn(
                  "flex items-center gap-1",
                  isOverdue ? "text-red-600 font-semibold" : "text-muted-foreground"
                )}>
                  <Clock className="h-3 w-3" />
                  {isOverdue ? "Overdue" : "Due"}: {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              )}
              {task.ai_confidence && (
                <span className="flex items-center gap-1 text-muted-foreground/70">
                  <span className="font-medium">AI</span> {Math.round(task.ai_confidence * 100)}%
                </span>
              )}
            </div>
            <span className="text-muted-foreground/50">
              {createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 p-6 lg:p-8 bg-muted/20 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-primary/10 rounded-xl">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">TaskPool</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-powered task management by action type
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/taskpool-board">
            <Button variant="outline" size="sm" className="h-9 gap-2">
              <Maximize2 className="h-4 w-4" />
              Full Board
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTasks(false)}
            disabled={refreshing}
            className="h-9"
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)} className="h-9">
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* View Tabs and Filters Row */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
        <Tabs value={currentView} onValueChange={setCurrentView}>
          <TabsList className="h-10 p-1">
            <TabsTrigger value="suggested" className="flex items-center gap-2 px-4 relative">
              <Sparkles className="h-4 w-4" />
              Suggested
              {suggestionCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 min-w-5 px-1.5 text-xs bg-purple-100 text-purple-700 font-semibold"
                >
                  {suggestionCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="pool" className="flex items-center gap-2 px-4">
              <Layers className="h-4 w-4" />
              Pool
            </TabsTrigger>
            <TabsTrigger value="my_assigned" className="flex items-center gap-2 px-4">
              <UserPlus className="h-4 w-4" />
              My Assigned
            </TabsTrigger>
            <TabsTrigger value="my_claimed" className="flex items-center gap-2 px-4">
              <User className="h-4 w-4" />
              My Claimed
            </TabsTrigger>
            <TabsTrigger value="overdue" className="flex items-center gap-2 px-4">
              <AlertTriangle className="h-4 w-4" />
              Overdue
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64 h-10"
            />
          </div>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[160px] h-10">
              <Filter className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Suggested View */}
      {currentView === "suggested" ? (
        <SuggestedTasks onSuggestionCount={setSuggestionCount} />
      ) : (
        /* Pool View - Action Type Lanes */
        loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
                <Skeleton className="h-28 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {actionTypes.map((actionType) => {
              const Icon = getActionIcon(actionType.icon);
              const typeTasks = filterTasks(tasksByActionType[actionType.id] || []);

              return (
                <div key={actionType.id} className="flex flex-col bg-card rounded-xl shadow-sm border overflow-hidden">
                  {/* Lane Header - softer colors with left accent */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 border-b bg-muted/30"
                    style={{ borderLeftWidth: '4px', borderLeftColor: actionType.color }}
                  >
                    <div
                      className="p-1.5 rounded-md"
                      style={{ backgroundColor: `${actionType.color}15` }}
                    >
                      <Icon className="h-4 w-4" style={{ color: actionType.color }} />
                    </div>
                    <span className="font-semibold text-sm text-foreground">{actionType.label}</span>
                    <Badge
                      variant="secondary"
                      className="ml-auto text-xs font-medium"
                      style={{
                        backgroundColor: `${actionType.color}15`,
                        color: actionType.color
                      }}
                    >
                      {typeTasks.length}
                    </Badge>
                  </div>

                  {/* Lane Content - scrollable with max height */}
                  <div className="flex-1 p-3 space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto bg-muted/10">
                    {typeTasks.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <div
                          className="p-3 rounded-full mb-3"
                          style={{ backgroundColor: `${actionType.color}10` }}
                        >
                          <Icon className="h-6 w-6 opacity-40" style={{ color: actionType.color }} />
                        </div>
                        <p className="text-sm font-medium">No tasks</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Tasks will appear here</p>
                      </div>
                    ) : (
                      typeTasks.map(renderTaskCard)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          actionTypes={actionTypes}
          open={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => {
            loadTasks(false);
            setSelectedTask(null);
          }}
          onClaim={handleClaimTask}
          onRelease={handleReleaseTask}
        />
      )}

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        actionTypes={actionTypes}
        onCreated={() => {
          loadTasks(false);
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}
