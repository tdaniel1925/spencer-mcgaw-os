"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Plus,
  Filter,
  Eye,
  Edit,
  Trash2,
  MoreHorizontal,
  Printer,
  Phone,
  Mail,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

// Mock data
const mockTasks = [
  {
    id: "TSK001",
    title: "Send 2023 tax return copy to client",
    description: "Client requested a copy of their 2023 tax return",
    client: { id: "1", name: "John Smith", avatar: "" },
    assignee: { id: "1", name: "Elizabeth", avatar: "" },
    status: "pending" as const,
    priority: "high" as const,
    source: "phone_call" as const,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
  },
  {
    id: "TSK002",
    title: "Review monthly bookkeeping package for ABC Corp",
    description: "Monthly bookkeeping review and reconciliation",
    client: { id: "2", name: "ABC Corp", avatar: "" },
    assignee: { id: "2", name: "Britney", avatar: "" },
    status: "in_progress" as const,
    priority: "medium" as const,
    source: "email" as const,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 48),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: "TSK003",
    title: "Process urgent payroll documents",
    description: "Time-sensitive payroll processing required",
    client: { id: "3", name: "XYZ Inc", avatar: "" },
    assignee: { id: "2", name: "Britney", avatar: "" },
    status: "pending" as const,
    priority: "urgent" as const,
    source: "document_intake" as const,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 8),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4),
  },
  {
    id: "TSK004",
    title: "Schedule consultation with new prospect",
    description: "New client inquiry - needs initial consultation",
    client: { id: "4", name: "Williams Consulting", avatar: "" },
    assignee: { id: "3", name: "Hunter McGaw", avatar: "" },
    status: "pending" as const,
    priority: "medium" as const,
    source: "manual" as const,
    dueDate: undefined,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6),
  },
  {
    id: "TSK005",
    title: "Respond to IRS notice for Tech Solutions",
    description: "IRS inquiry needs immediate attention",
    client: { id: "5", name: "Tech Solutions LLC", avatar: "" },
    assignee: { id: "3", name: "Hunter McGaw", avatar: "" },
    status: "in_progress" as const,
    priority: "urgent" as const,
    source: "email" as const,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
  {
    id: "TSK006",
    title: "Send W-9 form to vendor",
    description: "Client needs W-9 sent to their vendor",
    client: { id: "6", name: "Sarah Johnson", avatar: "" },
    assignee: { id: "1", name: "Elizabeth", avatar: "" },
    status: "completed" as const,
    priority: "low" as const,
    source: "phone_call" as const,
    dueDate: new Date(Date.now() - 1000 * 60 * 60 * 2),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
];

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

export default function TasksPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTasks = mockTasks.filter((task) => {
    const matchesStatus =
      statusFilter === "all" || task.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || task.priority === priorityFilter;
    const matchesSearch =
      task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.client.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
  });

  const taskCounts = {
    total: mockTasks.length,
    pending: mockTasks.filter((t) => t.status === "pending").length,
    inProgress: mockTasks.filter((t) => t.status === "in_progress").length,
    completed: mockTasks.filter((t) => t.status === "completed").length,
  };

  return (
    <>
      <Header title="Tasks" />
      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Tasks"
            value={taskCounts.total}
            change={{ value: 12.5, period: "30 days" }}
            icon={<ClipboardList className="h-6 w-6 text-primary-foreground" />}
            iconBg="bg-primary"
          />
          <StatCard
            title="Pending"
            value={taskCounts.pending}
            change={{ value: 5.2, period: "30 days" }}
            icon={<Clock className="h-6 w-6 text-yellow-700" />}
            iconBg="bg-yellow-100"
          />
          <StatCard
            title="In Progress"
            value={taskCounts.inProgress}
            change={{ value: -2.1, period: "30 days" }}
            icon={<AlertCircle className="h-6 w-6 text-blue-700" />}
            iconBg="bg-blue-100"
          />
          <StatCard
            title="Completed"
            value={taskCounts.completed}
            change={{ value: 18.3, period: "30 days" }}
            icon={<CheckCircle className="h-6 w-6 text-green-700" />}
            iconBg="bg-green-100"
          />
        </div>

        {/* Tasks Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold">Task List</CardTitle>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              {/* Priority Filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-36">
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

              {/* Print */}
              <Button variant="outline" size="icon">
                <Printer className="h-4 w-4" />
              </Button>

              {/* Add Task */}
              <Dialog>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Create New Task</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Task Title</Label>
                      <Input id="title" placeholder="Enter task title" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Enter task description"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Client</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select client" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">John Smith</SelectItem>
                            <SelectItem value="2">ABC Corp</SelectItem>
                            <SelectItem value="3">XYZ Inc</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Assignee</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Elizabeth</SelectItem>
                            <SelectItem value="2">Britney</SelectItem>
                            <SelectItem value="3">Hunter McGaw</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Priority</Label>
                        <Select>
                          <SelectTrigger>
                            <SelectValue placeholder="Select priority" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input type="date" />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline">Cancel</Button>
                    <Button className="bg-primary">Create Task</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Task ID</TableHead>
                  <TableHead>Task</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Assignee</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const SourceIcon = sourceIcons[task.source];
                  return (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium text-primary">
                        #{task.id}
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <div className="truncate font-medium">{task.title}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {task.description}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={task.client.avatar} />
                            <AvatarFallback className="text-xs bg-muted">
                              {task.client.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{task.client.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={task.assignee.avatar} />
                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                              {task.assignee.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{task.assignee.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <SourceIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground capitalize">
                            {task.source.replace("_", " ")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "font-normal",
                            priorityConfig[task.priority].className
                          )}
                        >
                          {priorityConfig[task.priority].label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-normal",
                            statusConfig[task.status].className
                          )}
                        >
                          {statusConfig[task.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.dueDate
                          ? format(task.dueDate, "MMM d, yyyy")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Task
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark Complete
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
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

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing 1 to {filteredTasks.length} of {mockTasks.length} entries
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-primary text-primary-foreground"
                >
                  1
                </Button>
                <Button variant="outline" size="sm">
                  2
                </Button>
                <Button variant="outline" size="sm">
                  3
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
