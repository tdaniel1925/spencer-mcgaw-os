"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit,
  GanttChart,
  ListTodo,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Save,
  Send,
  Trash2,
  User,
  Users,
  AlertTriangle,
  Play,
  Pause,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isPast, isToday, addDays, parseISO, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";

// Types
interface ProjectTask {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  status: string;
  assigned_to: string | null;
  due_date: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  sort_order: number;
  completed_at: string | null;
  assigned_user?: {
    id: string;
    full_name: string;
  };
}

interface ProjectNote {
  id: string;
  content: string;
  note_type: string;
  created_at: string;
  user?: {
    id: string;
    full_name: string;
  };
}

interface Project {
  id: string;
  name: string;
  project_type: string;
  status: string;
  tax_year: number | null;
  due_date: string | null;
  internal_deadline: string | null;
  extension_date: string | null;
  period_start: string | null;
  period_end: string | null;
  progress_percent: number;
  notes: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  client?: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  assigned_user?: {
    id: string;
    full_name: string;
  };
  reviewer?: {
    id: string;
    full_name: string;
  };
  partner?: {
    id: string;
    full_name: string;
  };
  template?: {
    id: string;
    name: string;
  };
}

interface TeamMember {
  id: string;
  full_name: string;
  email: string;
}

// Status configuration
const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string }> = {
  not_started: { label: "Not Started", color: "text-slate-600", bgColor: "bg-slate-100" },
  in_progress: { label: "In Progress", color: "text-blue-600", bgColor: "bg-blue-100" },
  awaiting_client: { label: "Awaiting Client", color: "text-amber-600", bgColor: "bg-amber-100" },
  under_review: { label: "Under Review", color: "text-purple-600", bgColor: "bg-purple-100" },
  ready_to_file: { label: "Ready to File", color: "text-cyan-600", bgColor: "bg-cyan-100" },
  completed: { label: "Completed", color: "text-green-600", bgColor: "bg-green-100" },
  on_hold: { label: "On Hold", color: "text-orange-600", bgColor: "bg-orange-100" },
  cancelled: { label: "Cancelled", color: "text-red-600", bgColor: "bg-red-100" },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: "Pending", color: "text-slate-600" },
  in_progress: { label: "In Progress", color: "text-blue-600" },
  completed: { label: "Completed", color: "text-green-600" },
  blocked: { label: "Blocked", color: "text-red-600" },
  skipped: { label: "Skipped", color: "text-muted-foreground" },
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  tax_1040: "1040 Individual",
  tax_1120: "1120 Corporation",
  tax_1120s: "1120-S S-Corp",
  tax_1065: "1065 Partnership",
  tax_1041: "1041 Trust/Estate",
  tax_990: "990 Nonprofit",
  tax_5500: "5500 Retirement",
  bookkeeping_monthly: "Monthly Bookkeeping",
  bookkeeping_quarterly: "Quarterly Bookkeeping",
  payroll: "Payroll",
  advisory: "Advisory",
  audit: "Audit",
  review: "Review",
  compilation: "Compilation",
  other: "Other",
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [notes, setNotes] = useState<ProjectNote[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tasks");

  // Task dialog
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    task_type: "firm_task",
    assigned_to: "",
    due_date: "",
    estimated_hours: "",
  });
  const [savingTask, setSavingTask] = useState(false);

  // Note input
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Project status update
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch project data
  const fetchProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        setTasks(data.tasks || []);
        setNotes(data.notes || []);
      } else if (response.status === 404) {
        toast.error("Project not found");
        router.push("/projects");
      }
    } catch (error) {
      console.error("Error fetching project:", error);
      toast.error("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId, router]);

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/users");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  }, []);

  useEffect(() => {
    fetchProject();
    fetchTeamMembers();
  }, [fetchProject, fetchTeamMembers]);

  // Update project status
  const updateProjectStatus = async (newStatus: string) => {
    if (!project) return;
    setUpdatingStatus(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
        toast.success(`Status updated to ${STATUS_CONFIG[newStatus]?.label || newStatus}`);
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Toggle task completion
  const toggleTaskStatus = async (task: ProjectTask) => {
    const newStatus = task.status === "completed" ? "pending" : "completed";
    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tasks: [{ id: task.id, status: newStatus }],
        }),
      });

      if (response.ok) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id
              ? { ...t, status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null }
              : t
          )
        );
        // Refresh project to get updated progress
        fetchProject();
      }
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error("Failed to update task");
    }
  };

  // Save task (create or update)
  const saveTask = async () => {
    if (!taskForm.title.trim()) {
      toast.error("Task title is required");
      return;
    }

    setSavingTask(true);
    try {
      if (editingTask) {
        // Update existing task
        const response = await fetch(`/api/projects/${projectId}/tasks`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tasks: [{
              id: editingTask.id,
              ...taskForm,
              estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
              assigned_to: taskForm.assigned_to || null,
              due_date: taskForm.due_date || null,
            }],
          }),
        });

        if (response.ok) {
          toast.success("Task updated");
          fetchProject();
        }
      } else {
        // Create new task
        const response = await fetch(`/api/projects/${projectId}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...taskForm,
            estimated_hours: taskForm.estimated_hours ? parseFloat(taskForm.estimated_hours) : null,
            assigned_to: taskForm.assigned_to || null,
            due_date: taskForm.due_date || null,
          }),
        });

        if (response.ok) {
          toast.success("Task created");
          fetchProject();
        }
      }

      setTaskDialogOpen(false);
      setEditingTask(null);
      setTaskForm({
        title: "",
        description: "",
        task_type: "firm_task",
        assigned_to: "",
        due_date: "",
        estimated_hours: "",
      });
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error("Failed to save task");
    } finally {
      setSavingTask(false);
    }
  };

  // Add note
  const addNote = async () => {
    if (!newNote.trim()) return;

    setSavingNote(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newNote,
          note_type: "general",
        }),
      });

      if (response.ok) {
        setNewNote("");
        fetchProject();
        toast.success("Note added");
      }
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error("Failed to add note");
    } finally {
      setSavingNote(false);
    }
  };

  // Open task dialog for editing
  const openEditTask = (task: ProjectTask) => {
    setEditingTask(task);
    setTaskForm({
      title: task.title,
      description: task.description || "",
      task_type: task.task_type,
      assigned_to: task.assigned_to || "",
      due_date: task.due_date ? format(new Date(task.due_date), "yyyy-MM-dd") : "",
      estimated_hours: task.estimated_hours?.toString() || "",
    });
    setTaskDialogOpen(true);
  };

  // Get due date status
  const getDueDateStatus = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const daysUntil = differenceInDays(date, new Date());

    if (isPast(date) && !isToday(date)) {
      return { label: "Overdue", color: "text-red-600", urgent: true };
    }
    if (daysUntil <= 7) {
      return { label: `${daysUntil}d left`, color: "text-amber-600", urgent: false };
    }
    return { label: format(date, "MMM d"), color: "text-muted-foreground", urgent: false };
  };

  // Calculate task stats
  const taskStats = {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    pending: tasks.filter((t) => t.status === "pending").length,
  };

  if (loading) {
    return (
      <>
        <Header title="Loading..." />
        <main className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </main>
      </>
    );
  }

  if (!project) {
    return (
      <>
        <Header title="Project Not Found" />
        <main className="flex flex-col items-center justify-center py-24">
          <p className="text-muted-foreground mb-4">This project could not be found.</p>
          <Button onClick={() => router.push("/projects")}>Back to Projects</Button>
        </main>
      </>
    );
  }

  const statusConfig = STATUS_CONFIG[project.status];
  const projectDueStatus = getDueDateStatus(project.due_date);

  return (
    <>
      <Header title={project.name} />
      <main className="p-6 space-y-6">
        {/* Back button and actions */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.push("/projects")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Projects
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchProject}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/clients/${project.client?.id}`)}>
                  <Building2 className="h-4 w-4 mr-2" />
                  View Client
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Project Header Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {/* Left: Main info */}
              <div className="flex-1 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Building2 className="h-4 w-4" />
                      <span
                        className="hover:underline cursor-pointer"
                        onClick={() => project.client && router.push(`/clients/${project.client.id}`)}
                      >
                        {project.client?.name || "No client"}
                      </span>
                    </div>
                    <h1 className="text-2xl font-bold">{project.name}</h1>
                    <div className="flex items-center gap-3 mt-2">
                      <Badge variant="outline">
                        {PROJECT_TYPE_LABELS[project.project_type] || project.project_type}
                      </Badge>
                      {project.tax_year && (
                        <Badge variant="secondary">TY {project.tax_year}</Badge>
                      )}
                    </div>
                  </div>

                  {/* Status dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("gap-2", statusConfig?.color)}
                        disabled={updatingStatus}
                      >
                        {updatingStatus ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <span className={cn("h-2 w-2 rounded-full", statusConfig?.bgColor)} />
                            {statusConfig?.label || project.status}
                            <ChevronDown className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                        <DropdownMenuItem
                          key={key}
                          onClick={() => updateProjectStatus(key)}
                          className={cn(project.status === key && "bg-muted")}
                        >
                          <span className={cn("h-2 w-2 rounded-full mr-2", config.bgColor)} />
                          {config.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{project.progress_percent}%</span>
                  </div>
                  <Progress value={project.progress_percent} className="h-2" />
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>{taskStats.completed} of {taskStats.total} tasks complete</span>
                    {taskStats.inProgress > 0 && (
                      <span className="text-blue-600">{taskStats.inProgress} in progress</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Key dates and team */}
              <div className="md:w-72 space-y-4">
                {/* Due dates */}
                <div className="space-y-2">
                  {project.due_date && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Due Date
                      </span>
                      <span className={cn("font-medium", projectDueStatus?.color)}>
                        {format(new Date(project.due_date), "MMM d, yyyy")}
                        {projectDueStatus?.urgent && (
                          <AlertTriangle className="h-4 w-4 inline ml-1 text-red-600" />
                        )}
                      </span>
                    </div>
                  )}
                  {project.internal_deadline && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Internal
                      </span>
                      <span className="font-medium">
                        {format(new Date(project.internal_deadline), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                  {project.extension_date && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Extension
                      </span>
                      <span className="font-medium">
                        {format(new Date(project.extension_date), "MMM d, yyyy")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Team */}
                <div className="pt-4 border-t space-y-2">
                  {project.assigned_user && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Preparer</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {project.assigned_user.full_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{project.assigned_user.full_name}</span>
                      </div>
                    </div>
                  )}
                  {project.reviewer && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Reviewer</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {project.reviewer.full_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{project.reviewer.full_name}</span>
                      </div>
                    </div>
                  )}
                  {project.partner && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Partner</span>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {project.partner.full_name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{project.partner.full_name}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for Tasks, Timeline, Notes */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="tasks" className="gap-2">
              <ListTodo className="h-4 w-4" />
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="timeline" className="gap-2">
              <GanttChart className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              <FileText className="h-4 w-4" />
              Details
            </TabsTrigger>
          </TabsList>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg">Project Tasks</CardTitle>
                <Button size="sm" onClick={() => setTaskDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <ListTodo className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No tasks yet. Add tasks to track project progress.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {tasks.map((task) => {
                      const taskDueStatus = getDueDateStatus(task.due_date);
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors",
                            task.status === "completed" && "opacity-60"
                          )}
                        >
                          <Checkbox
                            checked={task.status === "completed"}
                            onCheckedChange={() => toggleTaskStatus(task)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "font-medium",
                                  task.status === "completed" && "line-through text-muted-foreground"
                                )}
                              >
                                {task.title}
                              </span>
                              {task.status !== "completed" && task.status !== "pending" && (
                                <Badge variant="outline" className={cn("text-xs", TASK_STATUS_CONFIG[task.status]?.color)}>
                                  {TASK_STATUS_CONFIG[task.status]?.label}
                                </Badge>
                              )}
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {task.description}
                              </p>
                            )}
                          </div>

                          {/* Task meta */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {task.estimated_hours && (
                              <span>{task.estimated_hours}h est</span>
                            )}
                            {taskDueStatus && (
                              <span className={taskDueStatus.color}>{taskDueStatus.label}</span>
                            )}
                            {task.assigned_user && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Avatar className="h-6 w-6">
                                      <AvatarFallback className="text-xs">
                                        {task.assigned_user.full_name?.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                  </TooltipTrigger>
                                  <TooltipContent>{task.assigned_user.full_name}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditTask(task)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Timeline</CardTitle>
                <CardDescription>Visual timeline of project tasks and milestones</CardDescription>
              </CardHeader>
              <CardContent>
                <TimelineView tasks={tasks} project={project} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes Tab */}
          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Add note input */}
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a note..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button
                    onClick={addNote}
                    disabled={!newNote.trim() || savingNote}
                    className="self-end"
                  >
                    {savingNote ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {/* Notes list */}
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {notes.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">
                        No notes yet. Add notes to keep track of important information.
                      </p>
                    ) : (
                      notes.map((note) => (
                        <div key={note.id} className="p-3 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 mb-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {note.user?.full_name?.charAt(0) || "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{note.user?.full_name || "Unknown"}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(note.created_at), "MMM d, yyyy h:mm a")}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Project Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Project Type</Label>
                      <p className="font-medium">{PROJECT_TYPE_LABELS[project.project_type] || project.project_type}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Tax Year</Label>
                      <p className="font-medium">{project.tax_year || "N/A"}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Period</Label>
                      <p className="font-medium">
                        {project.period_start && project.period_end
                          ? `${format(new Date(project.period_start), "MMM d, yyyy")} - ${format(new Date(project.period_end), "MMM d, yyyy")}`
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Template Used</Label>
                      <p className="font-medium">{project.template?.name || "None"}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-muted-foreground">Created</Label>
                      <p className="font-medium">{format(new Date(project.created_at), "MMM d, yyyy")}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Started</Label>
                      <p className="font-medium">
                        {project.started_at ? format(new Date(project.started_at), "MMM d, yyyy") : "Not started"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Completed</Label>
                      <p className="font-medium">
                        {project.completed_at ? format(new Date(project.completed_at), "MMM d, yyyy") : "Not completed"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Notes</Label>
                      <p className="font-medium">{project.notes || "No notes"}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Task Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingTask ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Task title"
                value={taskForm.title}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Task description"
                value={taskForm.description}
                onChange={(e) => setTaskForm((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Select
                  value={taskForm.assigned_to}
                  onValueChange={(value) => setTaskForm((prev) => ({ ...prev, assigned_to: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select person" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={taskForm.due_date}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Task Type</Label>
                <Select
                  value={taskForm.task_type}
                  onValueChange={(value) => setTaskForm((prev) => ({ ...prev, task_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="firm_task">Firm Task</SelectItem>
                    <SelectItem value="client_task">Client Task</SelectItem>
                    <SelectItem value="review_task">Review Task</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Est. Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="0"
                  value={taskForm.estimated_hours}
                  onChange={(e) => setTaskForm((prev) => ({ ...prev, estimated_hours: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveTask} disabled={savingTask}>
              {savingTask && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTask ? "Update Task" : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Timeline View Component
function TimelineView({ tasks, project }: { tasks: ProjectTask[]; project: Project }) {
  // Calculate timeline range
  const today = new Date();
  const startDate = project.started_at
    ? new Date(project.started_at)
    : project.created_at
      ? new Date(project.created_at)
      : today;
  const endDate = project.due_date
    ? addDays(new Date(project.due_date), 7)
    : addDays(today, 30);

  const totalDays = Math.max(differenceInDays(endDate, startDate), 14);
  const dayWidth = 30; // pixels per day

  // Get tasks with dates
  const tasksWithDates = tasks.filter((t) => t.due_date);

  if (tasksWithDates.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GanttChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No tasks with due dates to display on timeline.</p>
        <p className="text-sm mt-1">Add due dates to tasks to see them here.</p>
      </div>
    );
  }

  // Generate week markers
  const weeks: Date[] = [];
  let currentDate = startOfDay(startDate);
  while (currentDate <= endDate) {
    weeks.push(currentDate);
    currentDate = addDays(currentDate, 7);
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: totalDays * dayWidth + 200 }}>
        {/* Header with dates */}
        <div className="flex border-b pb-2 mb-4">
          <div className="w-[200px] flex-shrink-0 font-medium">Task</div>
          <div className="flex-1 relative">
            <div className="flex">
              {weeks.map((week, i) => (
                <div
                  key={i}
                  className="text-xs text-muted-foreground"
                  style={{ width: 7 * dayWidth }}
                >
                  {format(week, "MMM d")}
                </div>
              ))}
            </div>
            {/* Today marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{
                left: Math.max(0, differenceInDays(today, startDate)) * dayWidth,
              }}
            />
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-2">
          {tasksWithDates.map((task) => {
            const taskStart = task.due_date
              ? addDays(new Date(task.due_date), -(task.estimated_hours || 8) / 8)
              : startDate;
            const taskEnd = task.due_date ? new Date(task.due_date) : addDays(taskStart, 1);
            const startOffset = Math.max(0, differenceInDays(taskStart, startDate));
            const duration = Math.max(1, differenceInDays(taskEnd, taskStart));

            return (
              <div key={task.id} className="flex items-center">
                <div className="w-[200px] flex-shrink-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full flex-shrink-0",
                        task.status === "completed" ? "bg-green-500" :
                        task.status === "in_progress" ? "bg-blue-500" :
                        "bg-slate-300"
                      )}
                    />
                    <span className={cn(
                      "text-sm truncate",
                      task.status === "completed" && "line-through text-muted-foreground"
                    )}>
                      {task.title}
                    </span>
                  </div>
                </div>
                <div className="flex-1 relative h-6">
                  <div
                    className={cn(
                      "absolute h-4 rounded top-1",
                      task.status === "completed" ? "bg-green-200" :
                      task.status === "in_progress" ? "bg-blue-200" :
                      "bg-slate-200"
                    )}
                    style={{
                      left: startOffset * dayWidth,
                      width: Math.max(duration * dayWidth, 4),
                    }}
                  >
                    <div
                      className={cn(
                        "h-full rounded",
                        task.status === "completed" ? "bg-green-500" :
                        task.status === "in_progress" ? "bg-blue-500" :
                        "bg-slate-400"
                      )}
                      style={{
                        width: task.status === "completed" ? "100%" : task.status === "in_progress" ? "50%" : "0%"
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Milestones: Due date, Extension */}
        <div className="mt-6 pt-4 border-t">
          <div className="flex items-center">
            <div className="w-[200px] flex-shrink-0 text-sm font-medium">Milestones</div>
            <div className="flex-1 relative h-8">
              {project.due_date && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute top-0 w-4 h-4 bg-red-500 rounded-full transform -translate-x-1/2 cursor-pointer"
                        style={{
                          left: differenceInDays(new Date(project.due_date), startDate) * dayWidth,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      Due Date: {format(new Date(project.due_date), "MMM d, yyyy")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {project.internal_deadline && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className="absolute top-0 w-4 h-4 bg-amber-500 rounded-full transform -translate-x-1/2 cursor-pointer"
                        style={{
                          left: differenceInDays(new Date(project.internal_deadline), startDate) * dayWidth,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      Internal Deadline: {format(new Date(project.internal_deadline), "MMM d, yyyy")}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
