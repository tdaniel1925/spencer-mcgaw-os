"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Plus,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Printer,
  Phone,
  Mail,
  FileText,
  Loader2,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  FlaskConical,
  Users,
  ChevronDown,
  ArrowRight,
  UserPlus,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

// Types
interface Task {
  id: string;
  title: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "urgent";
  source: "phone_call" | "email" | "document_intake" | "manual";
  source_id: string | null;
  client_id: string | null;
  client_name: string | null;
  assignee_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  tags: string[] | null;
  estimated_minutes: number | null;
  actual_minutes: number | null;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  avatar_url?: string | null;
}

interface TestEvent {
  id: string;
  action: string;
  resource_type: string;
  resource_name: string | null;
  user_email: string;
  created_at: string;
  details: Record<string, unknown>;
}

interface TestStats {
  total_test_tasks: number;
  assigned: number;
  unassigned: number;
  by_status: Record<string, number>;
}

// Config
const statusConfig = {
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-700 border-blue-200",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700 border-green-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-gray-100 text-gray-700 border-gray-200",
  },
};

const priorityConfig = {
  low: { label: "Low", className: "bg-gray-100 text-gray-600" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-600" },
  high: { label: "High", className: "bg-orange-100 text-orange-600" },
  urgent: { label: "Urgent", className: "bg-red-100 text-red-600" },
};

const sourceIcons = {
  phone_call: Phone,
  email: Mail,
  document_intake: FileText,
  manual: ClipboardList,
};

const ITEMS_PER_PAGE = 20;

export default function TaskTablePage() {
  // Task state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTestOnly, setShowTestOnly] = useState(false);

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  // Selection state
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Test mode state
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testRunning, setTestRunning] = useState(false);
  const [testSpeed, setTestSpeed] = useState([5]); // seconds between task generation
  const [testEvents, setTestEvents] = useState<TestEvent[]>([]);
  const [testStats, setTestStats] = useState<TestStats | null>(null);
  const testIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Dialog states
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // "View as User" for admins
  const [viewAsUser, setViewAsUser] = useState<string | null>(null);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (priorityFilter !== "all") params.set("priority", priorityFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", ITEMS_PER_PAGE.toString());
      params.set("offset", ((page - 1) * ITEMS_PER_PAGE).toString());

      const response = await fetch(`/api/tasks?${params}`);
      if (response.ok) {
        const data = await response.json();
        let filteredTasks = data.tasks || [];

        // Filter by assignee if needed
        if (assigneeFilter !== "all") {
          if (assigneeFilter === "unassigned") {
            filteredTasks = filteredTasks.filter((t: Task) => !t.assignee_id);
          } else {
            filteredTasks = filteredTasks.filter((t: Task) => t.assignee_id === assigneeFilter);
          }
        }

        // Filter test tasks if needed
        if (showTestOnly) {
          filteredTasks = filteredTasks.filter((t: Task) => t.source_id?.startsWith("test_"));
        }

        setTasks(filteredTasks);
        setTotalCount(data.count || 0);
      }
    } catch (error) {
      console.error("Error fetching tasks:", error);
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, searchQuery, page, assigneeFilter, showTestOnly]);

  // Fetch team members
  const fetchTeamMembers = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users");
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.users || []);
      }
    } catch (error) {
      console.error("Error fetching team members:", error);
    }
  }, []);

  // Fetch test stats
  const fetchTestStats = useCallback(async () => {
    if (!testModeEnabled) return;
    try {
      const response = await fetch("/api/test/tasks");
      if (response.ok) {
        const data = await response.json();
        setTestStats(data);
      }
    } catch (error) {
      console.error("Error fetching test stats:", error);
    }
  }, [testModeEnabled]);

  // Fetch test events
  const fetchTestEvents = useCallback(async () => {
    if (!testModeEnabled) return;
    try {
      const response = await fetch("/api/test/events?limit=20");
      if (response.ok) {
        const data = await response.json();
        setTestEvents(data.events || []);
      }
    } catch (error) {
      console.error("Error fetching test events:", error);
    }
  }, [testModeEnabled]);

  useEffect(() => {
    fetchTasks();
    fetchTeamMembers();
  }, [fetchTasks, fetchTeamMembers]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, priorityFilter, searchQuery, assigneeFilter, showTestOnly]);

  useEffect(() => {
    if (testModeEnabled) {
      fetchTestStats();
      fetchTestEvents();
    }
  }, [testModeEnabled, fetchTestStats, fetchTestEvents]);

  // Generate test task
  const generateTestTask = async () => {
    try {
      const response = await fetch("/api/test/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 1 }),
      });
      if (response.ok) {
        fetchTasks();
        fetchTestStats();
        fetchTestEvents();
      }
    } catch (error) {
      console.error("Error generating test task:", error);
    }
  };

  // Start test mode
  const startTestMode = () => {
    setTestRunning(true);
    testIntervalRef.current = setInterval(() => {
      generateTestTask();
    }, testSpeed[0] * 1000);
    toast.success("Test mode started");
  };

  // Stop test mode
  const stopTestMode = () => {
    setTestRunning(false);
    if (testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = null;
    }
    toast.info("Test mode stopped");
  };

  // Reset test data
  const resetTestData = async () => {
    stopTestMode();
    try {
      const [tasksRes, eventsRes] = await Promise.all([
        fetch("/api/test/tasks", { method: "DELETE" }),
        fetch("/api/test/events", { method: "DELETE" }),
      ]);

      if (tasksRes.ok && eventsRes.ok) {
        toast.success("Test data cleared");
        fetchTasks();
        fetchTestStats();
        setTestEvents([]);
      }
    } catch (error) {
      console.error("Error resetting test data:", error);
      toast.error("Failed to reset test data");
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (testIntervalRef.current) {
        clearInterval(testIntervalRef.current);
      }
    };
  }, []);

  // Update test interval when speed changes
  useEffect(() => {
    if (testRunning && testIntervalRef.current) {
      clearInterval(testIntervalRef.current);
      testIntervalRef.current = setInterval(() => {
        generateTestTask();
      }, testSpeed[0] * 1000);
    }
  }, [testSpeed, testRunning]);

  // Handle task assignment
  const handleAssignTask = async (taskId: string, assigneeId: string | null, assigneeName: string | null) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignee_id: assigneeId,
          assignee_name: assigneeName,
          status: assigneeId ? "in_progress" : "pending",
        }),
      });

      if (response.ok) {
        toast.success(assigneeId ? `Assigned to ${assigneeName}` : "Task unassigned");
        fetchTasks();

        // Log event for test mode
        if (testModeEnabled) {
          await fetch("/api/test/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "task_assigned",
              resource_type: "task",
              resource_id: taskId,
              resource_name: assigneeName,
              details: { assignee_id: assigneeId },
            }),
          });
          fetchTestEvents();
        }
      } else {
        toast.error("Failed to assign task");
      }
    } catch (error) {
      console.error("Error assigning task:", error);
      toast.error("Failed to assign task");
    }
  };

  // Handle status change
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          ...(newStatus === "completed" && { completed_at: new Date().toISOString() }),
        }),
      });

      if (response.ok) {
        toast.success(`Status updated to ${statusConfig[newStatus as keyof typeof statusConfig]?.label}`);
        fetchTasks();

        // Log event for test mode
        if (testModeEnabled) {
          await fetch("/api/test/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "task_status_changed",
              resource_type: "task",
              resource_id: taskId,
              details: { new_status: newStatus },
            }),
          });
          fetchTestEvents();
        }
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    }
  };

  // Bulk actions
  const handleBulkAssign = async (assigneeId: string, assigneeName: string) => {
    const promises = Array.from(selectedTasks).map((taskId) =>
      handleAssignTask(taskId, assigneeId, assigneeName)
    );
    await Promise.all(promises);
    setSelectedTasks(new Set());
    setSelectAll(false);
    toast.success(`Assigned ${selectedTasks.size} tasks to ${assigneeName}`);
  };

  const handleBulkDelete = async () => {
    try {
      const promises = Array.from(selectedTasks).map((taskId) =>
        fetch(`/api/tasks/${taskId}`, { method: "DELETE" })
      );
      await Promise.all(promises);
      setSelectedTasks(new Set());
      setSelectAll(false);
      setBulkDeleteDialogOpen(false);
      fetchTasks();
      toast.success(`Deleted ${selectedTasks.size} tasks`);
    } catch (error) {
      console.error("Error deleting tasks:", error);
      toast.error("Failed to delete tasks");
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask) return;
    try {
      const response = await fetch(`/api/tasks/${selectedTask.id}`, { method: "DELETE" });
      if (response.ok) {
        toast.success("Task deleted");
        setDeleteDialogOpen(false);
        setSelectedTask(null);
        fetchTasks();
      } else {
        toast.error("Failed to delete task");
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Failed to delete task");
    }
  };

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map((t) => t.id)));
    }
    setSelectAll(!selectAll);
  };

  const toggleTaskSelection = (taskId: string) => {
    const newSelection = new Set(selectedTasks);
    if (newSelection.has(taskId)) {
      newSelection.delete(taskId);
    } else {
      newSelection.add(taskId);
    }
    setSelectedTasks(newSelection);
    setSelectAll(newSelection.size === tasks.length);
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <>
      <Header title="Task Table" />
      <main className="p-6 space-y-6">
        {/* Test Mode Panel */}
        {testModeEnabled && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-amber-600" />
                  <CardTitle className="text-lg text-amber-800">Test Mode</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTestModeEnabled(false)}
                  className="text-amber-700 hover:text-amber-800"
                >
                  Close Test Panel
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Controls */}
                <div className="space-y-3">
                  <Label className="text-amber-800">Controls</Label>
                  <div className="flex items-center gap-2">
                    {!testRunning ? (
                      <Button
                        onClick={startTestMode}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start
                      </Button>
                    ) : (
                      <Button
                        onClick={stopTestMode}
                        variant="destructive"
                      >
                        <Square className="h-4 w-4 mr-2" />
                        Stop
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={resetTestData}
                      className="border-amber-400 text-amber-700 hover:bg-amber-100"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={generateTestTask}
                      className="border-amber-400 text-amber-700 hover:bg-amber-100"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Task
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-amber-700">
                      Task Generation Speed: {testSpeed[0]}s
                    </Label>
                    <Slider
                      value={testSpeed}
                      onValueChange={setTestSpeed}
                      min={1}
                      max={30}
                      step={1}
                      className="w-full"
                    />
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-3">
                  <Label className="text-amber-800">Test Stats</Label>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-white rounded p-2 border border-amber-200">
                      <span className="text-amber-600">Total Test Tasks</span>
                      <p className="font-bold text-amber-800">{testStats?.total_test_tasks || 0}</p>
                    </div>
                    <div className="bg-white rounded p-2 border border-amber-200">
                      <span className="text-amber-600">Unassigned</span>
                      <p className="font-bold text-amber-800">{testStats?.unassigned || 0}</p>
                    </div>
                    <div className="bg-white rounded p-2 border border-amber-200">
                      <span className="text-amber-600">Assigned</span>
                      <p className="font-bold text-amber-800">{testStats?.assigned || 0}</p>
                    </div>
                    <div className="bg-white rounded p-2 border border-amber-200">
                      <span className="text-amber-600">Status</span>
                      <p className="font-bold text-amber-800">
                        {testRunning ? "Running" : "Stopped"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Event Log */}
                <div className="space-y-3">
                  <Label className="text-amber-800">Event Log</Label>
                  <ScrollArea className="h-32 bg-white rounded border border-amber-200 p-2">
                    {testEvents.length === 0 ? (
                      <p className="text-sm text-amber-600">No events yet</p>
                    ) : (
                      <div className="space-y-1">
                        {testEvents.map((event) => (
                          <div
                            key={event.id}
                            className="text-xs text-amber-700 border-b border-amber-100 pb-1"
                          >
                            <span className="font-medium">{event.action}</span>
                            {event.resource_name && (
                              <span className="text-amber-500"> - {event.resource_name}</span>
                            )}
                            <span className="text-amber-400 ml-2">
                              {format(new Date(event.created_at), "HH:mm:ss")}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            title="Total Tasks"
            value={totalCount}
            icon={<ClipboardList className="h-6 w-6 text-primary-foreground" />}
            iconBg="bg-primary"
          />
          <StatCard
            title="Unassigned"
            value={tasks.filter((t) => !t.assignee_id).length}
            icon={<Users className="h-6 w-6 text-orange-700" />}
            iconBg="bg-orange-100"
          />
          <StatCard
            title="Pending"
            value={tasks.filter((t) => t.status === "pending").length}
            icon={<Clock className="h-6 w-6 text-yellow-700" />}
            iconBg="bg-yellow-100"
          />
          <StatCard
            title="In Progress"
            value={tasks.filter((t) => t.status === "in_progress").length}
            icon={<AlertCircle className="h-6 w-6 text-blue-700" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Completed"
            value={tasks.filter((t) => t.status === "completed").length}
            icon={<CheckCircle className="h-6 w-6 text-green-700" />}
            iconBg="bg-green-100"
          />
        </div>

        {/* Task Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
            <CardTitle className="text-lg font-semibold">All Tasks</CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>

              {/* Assignee Filter */}
              <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Assignee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-32">
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

              {/* Test Only Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="test-only"
                  checked={showTestOnly}
                  onCheckedChange={setShowTestOnly}
                />
                <Label htmlFor="test-only" className="text-sm">
                  Test Only
                </Label>
              </div>

              {/* View as User */}
              <Select value={viewAsUser || "admin"} onValueChange={(v) => setViewAsUser(v === "admin" ? null : v)}>
                <SelectTrigger className="w-40">
                  <Eye className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="View as..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin View</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Refresh */}
              <Button variant="outline" size="icon" onClick={() => fetchTasks()}>
                <RefreshCw className="h-4 w-4" />
              </Button>

              {/* Test Mode Toggle */}
              <Button
                variant={testModeEnabled ? "default" : "outline"}
                onClick={() => setTestModeEnabled(!testModeEnabled)}
                className={testModeEnabled ? "bg-amber-500 hover:bg-amber-600" : ""}
              >
                <FlaskConical className="h-4 w-4 mr-2" />
                Test Mode
              </Button>
            </div>
          </CardHeader>

          {/* Bulk Actions */}
          {selectedTasks.size > 0 && (
            <div className="px-6 pb-3 flex items-center gap-4 bg-muted/50">
              <span className="text-sm font-medium">
                {selectedTasks.size} selected
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign To
                    <ChevronDown className="h-4 w-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {teamMembers.map((member) => (
                    <DropdownMenuItem
                      key={member.id}
                      onClick={() => handleBulkAssign(member.id, member.full_name || member.email)}
                    >
                      <Avatar className="h-6 w-6 mr-2">
                        <AvatarFallback className="text-xs">
                          {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {member.full_name || member.email}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={() => setBulkDeleteDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedTasks(new Set());
                  setSelectAll(false);
                }}
              >
                Clear Selection
              </Button>
            </div>
          )}

          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No tasks found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {testModeEnabled
                    ? "Enable test mode and click Start to generate test tasks"
                    : "Adjust filters or create tasks to see them here"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={selectAll}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="w-[80px]">ID</TableHead>
                    <TableHead>Task</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="w-[180px]">Assignee</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead className="w-[140px]">Status</TableHead>
                    <TableHead className="w-[60px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.map((task) => {
                    const SourceIcon = sourceIcons[task.source] || ClipboardList;
                    const isTestTask = task.source_id?.startsWith("test_");
                    return (
                      <TableRow
                        key={task.id}
                        className={cn(
                          "hover:bg-muted/50",
                          isTestTask && "bg-amber-50/50"
                        )}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTasks.has(task.id)}
                            onCheckedChange={() => toggleTaskSelection(task.id)}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-primary">
                          #{task.id.slice(0, 6)}
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <div className="truncate font-medium">{task.title}</div>
                          {task.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {task.description}
                            </div>
                          )}
                          {isTestTask && (
                            <Badge variant="outline" className="text-xs mt-1 border-amber-300 text-amber-600">
                              Test
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.client_name ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs bg-muted">
                                  {task.client_name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm truncate max-w-[120px]">
                                {task.client_name}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={task.assignee_id || "unassigned"}
                            onValueChange={(value) => {
                              if (value === "unassigned") {
                                handleAssignTask(task.id, null, null);
                              } else {
                                const member = teamMembers.find((m) => m.id === value);
                                handleAssignTask(task.id, value, member?.full_name || member?.email || null);
                              }
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue>
                                {task.assignee_id ? (
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                        {(task.assignee_name || "?").slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <span className="truncate">{task.assignee_name}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">Unassigned</span>
                                )}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unassigned">
                                <span className="text-muted-foreground">Unassigned</span>
                              </SelectItem>
                              {teamMembers.map((member) => (
                                <SelectItem key={member.id} value={member.id}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="h-5 w-5">
                                      <AvatarFallback className="text-xs">
                                        {(member.full_name || member.email).slice(0, 2).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    {member.full_name || member.email}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <SourceIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground capitalize">
                              {(task.source || "manual").replace(/_/g, " ")}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn(
                              "font-normal text-xs",
                              priorityConfig[task.priority]?.className
                            )}
                          >
                            {priorityConfig[task.priority]?.label || task.priority}
                          </Badge>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={task.status}
                            onValueChange={(value) => handleStatusChange(task.id, value)}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue>
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "font-normal text-xs",
                                    statusConfig[task.status]?.className
                                  )}
                                >
                                  {statusConfig[task.status]?.label || task.status}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTask(task);
                                  setViewDialogOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => {
                                  setSelectedTask(task);
                                  setDeleteDialogOpen(true);
                                }}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {tasks.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to{" "}
                  {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {page} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* View Task Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Task Details</DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-4 py-4">
              <div>
                <Label className="text-muted-foreground">Task ID</Label>
                <p className="font-medium">#{selectedTask.id.slice(0, 8)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Title</Label>
                <p className="font-medium">{selectedTask.title}</p>
              </div>
              {selectedTask.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p>{selectedTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={cn("font-normal", statusConfig[selectedTask.status]?.className)}
                    >
                      {statusConfig[selectedTask.status]?.label}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">Priority</Label>
                  <div className="mt-1">
                    <Badge
                      variant="secondary"
                      className={cn("font-normal", priorityConfig[selectedTask.priority]?.className)}
                    >
                      {priorityConfig[selectedTask.priority]?.label}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Client</Label>
                  <p>{selectedTask.client_name || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Assignee</Label>
                  <p>{selectedTask.assignee_name || "-"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Source</Label>
                  <p className="capitalize">{(selectedTask.source || "manual").replace(/_/g, " ")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Created</Label>
                  <p>{format(new Date(selectedTask.created_at), "MMM d, yyyy h:mm a")}</p>
                </div>
              </div>
              {selectedTask.source_id?.startsWith("test_") && (
                <div className="bg-amber-50 p-3 rounded border border-amber-200">
                  <p className="text-sm text-amber-700">
                    This is a test task generated during test mode.
                  </p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this task? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteTask}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedTasks.size} Tasks</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedTasks.size} tasks? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
