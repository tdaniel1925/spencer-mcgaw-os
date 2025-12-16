"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Search,
  Plus,
  LayoutGrid,
  List,
  Calendar,
  User,
  Building2,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Filter,
  ChevronRight,
  FolderKanban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, differenceInDays, isPast, isToday } from "date-fns";
import { toast } from "sonner";

// Types
interface Project {
  id: string;
  name: string;
  project_type: string;
  status: string;
  tax_year: number | null;
  due_date: string | null;
  internal_deadline: string | null;
  progress_percent: number;
  created_at: string;
  client?: {
    id: string;
    name: string;
  };
  assigned_user?: {
    id: string;
    full_name: string;
  };
}

interface ProjectTemplate {
  id: string;
  name: string;
  project_type: string;
  default_days_to_complete: number;
}

interface Client {
  id: string;
  name: string;
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

// Kanban columns
const KANBAN_COLUMNS = [
  { id: "not_started", label: "Not Started" },
  { id: "in_progress", label: "In Progress" },
  { id: "awaiting_client", label: "Awaiting Client" },
  { id: "under_review", label: "Under Review" },
  { id: "ready_to_file", label: "Ready to File" },
  { id: "completed", label: "Completed" },
];

// Project type labels
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

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    client_id: "",
    template_id: "",
    name: "",
    project_type: "",
    tax_year: new Date().getFullYear(),
    due_date: "",
    notes: "",
  });

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (yearFilter !== "all") params.set("tax_year", yearFilter);

      const response = await fetch(`/api/projects?${params}`);
      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Error fetching projects:", error);
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, yearFilter]);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      const response = await fetch("/api/projects/templates");
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    }
  }, []);

  // Fetch clients for dropdown
  const fetchClients = useCallback(async () => {
    try {
      const response = await fetch("/api/clients?limit=500");
      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
    fetchTemplates();
    fetchClients();
  }, [fetchProjects, fetchTemplates, fetchClients]);

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (
        !project.name.toLowerCase().includes(query) &&
        !project.client?.name.toLowerCase().includes(query)
      ) {
        return false;
      }
    }
    if (typeFilter !== "all" && project.project_type !== typeFilter) {
      return false;
    }
    return true;
  });

  // Group projects by status for kanban
  const projectsByStatus = KANBAN_COLUMNS.reduce((acc, col) => {
    acc[col.id] = filteredProjects.filter((p) => p.status === col.id);
    return acc;
  }, {} as Record<string, Project[]>);

  // Create project
  const handleCreate = async () => {
    if (!formData.client_id || !formData.name || !formData.project_type) {
      toast.error("Client, name, and project type are required");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          template_id: formData.template_id || null,
          tax_year: formData.tax_year || null,
          due_date: formData.due_date || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Project created successfully");
        setCreateOpen(false);
        setFormData({
          client_id: "",
          template_id: "",
          name: "",
          project_type: "",
          tax_year: new Date().getFullYear(),
          due_date: "",
          notes: "",
        });
        fetchProjects();
        router.push(`/projects/${data.project.id}`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to create project");
      }
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Failed to create project");
    } finally {
      setSaving(false);
    }
  };

  // Update project status (drag and drop)
  const updateProjectStatus = async (projectId: string, newStatus: string) => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setProjects((prev) =>
          prev.map((p) => (p.id === projectId ? { ...p, status: newStatus } : p))
        );
        toast.success("Project status updated");
      }
    } catch (error) {
      console.error("Error updating project:", error);
      toast.error("Failed to update status");
    }
  };

  // Get due date status
  const getDueDateStatus = (dueDate: string | null) => {
    if (!dueDate) return null;
    const date = new Date(dueDate);
    const daysUntil = differenceInDays(date, new Date());

    if (isPast(date) && !isToday(date)) {
      return { label: "Overdue", color: "text-red-600", icon: AlertTriangle };
    }
    if (daysUntil <= 7) {
      return { label: `${daysUntil}d`, color: "text-amber-600", icon: Clock };
    }
    return { label: format(date, "MMM d"), color: "text-muted-foreground", icon: Calendar };
  };

  // Project card component
  const ProjectCard = ({ project }: { project: Project }) => {
    const dueStatus = getDueDateStatus(project.due_date);

    return (
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => router.push(`/projects/${project.id}`)}
      >
        <CardContent className="p-4 space-y-3">
          {/* Client name */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            {project.client?.name || "No client"}
          </div>

          {/* Project name */}
          <h3 className="font-medium text-sm line-clamp-2">{project.name}</h3>

          {/* Type badge */}
          <Badge variant="outline" className="text-[10px]">
            {PROJECT_TYPE_LABELS[project.project_type] || project.project_type}
          </Badge>

          {/* Progress */}
          {project.progress_percent > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{project.progress_percent}%</span>
              </div>
              <Progress value={project.progress_percent} className="h-1.5" />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t">
            {/* Due date */}
            {dueStatus && (
              <div className={cn("flex items-center gap-1 text-xs", dueStatus.color)}>
                <dueStatus.icon className="h-3 w-3" />
                {dueStatus.label}
              </div>
            )}

            {/* Assignee */}
            {project.assigned_user && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {project.assigned_user.full_name?.split(" ")[0]}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <>
      <Header title="Projects" />
      <main className="p-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{projects.length}</div>
              <div className="text-sm text-muted-foreground">Total Projects</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {projects.filter((p) => p.status === "in_progress").length}
              </div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-amber-600">
                {projects.filter((p) => p.status === "awaiting_client").length}
              </div>
              <div className="text-sm text-muted-foreground">Awaiting Client</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {projects.filter((p) => p.due_date && isPast(new Date(p.due_date))).length}
              </div>
              <div className="text-sm text-muted-foreground">Overdue</div>
            </CardContent>
          </Card>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search projects or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Type Filter */}
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Project Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Filter */}
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Tax Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Years</SelectItem>
              {[2025, 2024, 2023, 2022].map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([value, { label }]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 ml-auto">
            {/* View Toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Refresh */}
            <Button variant="outline" size="icon" onClick={fetchProjects}>
              <RefreshCw className="h-4 w-4" />
            </Button>

            {/* Create Project */}
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No projects found</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || typeFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Create your first project to get started"}
              </p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        ) : viewMode === "kanban" ? (
          /* Kanban View */
          <ScrollArea className="w-full">
            <div className="flex gap-4 pb-4" style={{ minWidth: KANBAN_COLUMNS.length * 300 }}>
              {KANBAN_COLUMNS.map((column) => (
                <div
                  key={column.id}
                  className="flex-shrink-0 w-[280px] bg-muted/30 rounded-lg"
                >
                  {/* Column Header */}
                  <div className="p-3 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{column.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {projectsByStatus[column.id]?.length || 0}
                      </Badge>
                    </div>
                  </div>

                  {/* Column Content */}
                  <ScrollArea className="h-[calc(100vh-380px)]">
                    <div className="p-2 space-y-2">
                      {projectsByStatus[column.id]?.map((project) => (
                        <ProjectCard key={project.id} project={project} />
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          /* List View */
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {filteredProjects.map((project) => {
                  const dueStatus = getDueDateStatus(project.due_date);
                  const statusConfig = STATUS_CONFIG[project.status];

                  return (
                    <div
                      key={project.id}
                      className="flex items-center gap-4 p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/projects/${project.id}`)}
                    >
                      {/* Progress indicator */}
                      <div className="w-12 h-12 relative">
                        <svg className="w-12 h-12 -rotate-90">
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            className="text-muted"
                          />
                          <circle
                            cx="24"
                            cy="24"
                            r="20"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                            strokeDasharray={`${project.progress_percent * 1.256} 126`}
                            className="text-primary"
                          />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                          {project.progress_percent}%
                        </span>
                      </div>

                      {/* Project info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{project.name}</h3>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", statusConfig?.color)}
                          >
                            {statusConfig?.label || project.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {project.client?.name || "No client"}
                          </span>
                          <span>
                            {PROJECT_TYPE_LABELS[project.project_type] || project.project_type}
                          </span>
                          {project.tax_year && <span>TY {project.tax_year}</span>}
                        </div>
                      </div>

                      {/* Due date */}
                      {dueStatus && (
                        <div className={cn("flex items-center gap-1 text-sm", dueStatus.color)}>
                          <dueStatus.icon className="h-4 w-4" />
                          {project.due_date && format(new Date(project.due_date), "MMM d, yyyy")}
                        </div>
                      )}

                      {/* Assignee */}
                      {project.assigned_user && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          {project.assigned_user.full_name}
                        </div>
                      )}

                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Create Project Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Client */}
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, client_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Template (optional) */}
            <div className="space-y-2">
              <Label>Template (optional)</Label>
              <Select
                value={formData.template_id}
                onValueChange={(value) => {
                  const template = templates.find((t) => t.id === value);
                  setFormData((prev) => ({
                    ...prev,
                    template_id: value,
                    project_type: template?.project_type || prev.project_type,
                    name: template?.name || prev.name,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template (auto-creates tasks)" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Project Name */}
            <div className="space-y-2">
              <Label>Project Name *</Label>
              <Input
                placeholder="e.g., 2024 Tax Return - Smith Family"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            {/* Project Type */}
            <div className="space-y-2">
              <Label>Project Type *</Label>
              <Select
                value={formData.project_type}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, project_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tax Year & Due Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tax Year</Label>
                <Select
                  value={formData.tax_year.toString()}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, tax_year: parseInt(value) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2025, 2024, 2023, 2022].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Input
                  type="date"
                  value={formData.due_date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, due_date: e.target.value }))}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional notes about this project"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
