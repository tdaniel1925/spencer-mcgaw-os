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
} from "lucide-react";
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
  claimed_by: string | null;
  claimed_at: string | null;
  created_at: string;
  ai_confidence: number | null;
  ai_extracted_data: Record<string, any>;
  source_type: string;
  action_type: ActionType | null;
  client: Client | null;
  notes: { count: number }[];
  activity: { count: number }[];
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
  urgent: "bg-red-500 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-green-500 text-white",
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

    return (
      <Card
        key={task.id}
        className="cursor-pointer hover:shadow-md transition-shadow group"
        onClick={() => setSelectedTask(task)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <div
              className="p-1.5 rounded-md"
              style={{ backgroundColor: task.action_type?.color || "#6B7280" }}
            >
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium truncate">{task.title}</h4>
              {task.client && (
                <p className="text-xs text-muted-foreground truncate">
                  {task.client.first_name} {task.client.last_name}
                  {task.client.company && ` - ${task.client.company}`}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
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

          <div className="flex items-center gap-2 mt-2">
            <Badge
              variant="secondary"
              className={cn("text-[10px] px-1.5", priorityColors[task.priority])}
            >
              {task.priority}
            </Badge>
            {task.due_date && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Clock className="h-3 w-3" />
                {new Date(task.due_date).toLocaleDateString()}
              </span>
            )}
            {task.ai_confidence && (
              <Badge variant="outline" className="text-[10px] px-1.5">
                AI {Math.round(task.ai_confidence * 100)}%
              </Badge>
            )}
            {task.notes && task.notes[0]?.count > 0 && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MessageSquare className="h-3 w-3" />
                {task.notes[0].count}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex-1 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">TaskPool</h1>
            <p className="text-sm text-muted-foreground">
              AI-powered task management by action type
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadTasks(false)}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Task
          </Button>
        </div>
      </div>

      {/* View Tabs */}
      <Tabs value={currentView} onValueChange={setCurrentView} className="mb-6">
        <TabsList>
          <TabsTrigger value="pool" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Pool View
          </TabsTrigger>
          <TabsTrigger value="my_claimed" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            My Claimed
          </TabsTrigger>
          <TabsTrigger value="my_clients" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            My Clients
          </TabsTrigger>
          <TabsTrigger value="overdue" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Overdue
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-4 w-4 mr-2" />
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

      {/* Pool View - Action Type Lanes */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {actionTypes.map((actionType) => {
            const Icon = getActionIcon(actionType.icon);
            const typeTasks = filterTasks(tasksByActionType[actionType.id] || []);

            return (
              <div key={actionType.id} className="flex flex-col">
                {/* Lane Header */}
                <div
                  className="flex items-center gap-2 p-3 rounded-t-lg"
                  style={{ backgroundColor: actionType.color }}
                >
                  <Icon className="h-5 w-5 text-white" />
                  <span className="font-medium text-white">{actionType.label}</span>
                  <Badge variant="secondary" className="ml-auto bg-white/20 text-white">
                    {typeTasks.length}
                  </Badge>
                </div>

                {/* Lane Content */}
                <div className="flex-1 bg-muted/30 rounded-b-lg p-2 space-y-2 min-h-[200px]">
                  {typeTasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <Icon className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm">No tasks</p>
                    </div>
                  ) : (
                    typeTasks.map(renderTaskCard)
                  )}
                </div>
              </div>
            );
          })}
        </div>
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
