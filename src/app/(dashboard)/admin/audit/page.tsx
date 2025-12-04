"use client";

import { useState, useEffect, useMemo } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Calendar,
  Clock,
  User,
  Monitor,
  MapPin,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  FileText,
  Users,
  Mail,
  Phone,
  Settings,
  Activity,
  TrendingUp,
  Globe,
  Laptop,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, subDays, startOfDay, endOfDay } from "date-fns";
import {
  AuditLogEntry,
  AuditCategory,
  AuditAction,
  AuditSeverity,
  AuditStatus,
} from "@/lib/audit/types";
import { getAllAuditLogs, seedAuditLogs } from "@/lib/audit/audit-context";

// Category icons
const categoryIcons: Record<AuditCategory, React.ElementType> = {
  authentication: Shield,
  client: Users,
  document: FileText,
  task: Activity,
  email: Mail,
  call: Phone,
  user_management: User,
  settings: Settings,
  billing: FileText,
  system: Monitor,
  security: Shield,
  data_export: Download,
  api: Globe,
};

// Category colors
const categoryColors: Record<AuditCategory, string> = {
  authentication: "bg-blue-100 text-blue-700 border-blue-200",
  client: "bg-green-100 text-green-700 border-green-200",
  document: "bg-purple-100 text-purple-700 border-purple-200",
  task: "bg-orange-100 text-orange-700 border-orange-200",
  email: "bg-pink-100 text-pink-700 border-pink-200",
  call: "bg-cyan-100 text-cyan-700 border-cyan-200",
  user_management: "bg-indigo-100 text-indigo-700 border-indigo-200",
  settings: "bg-gray-100 text-gray-700 border-gray-200",
  billing: "bg-emerald-100 text-emerald-700 border-emerald-200",
  system: "bg-slate-100 text-slate-700 border-slate-200",
  security: "bg-red-100 text-red-700 border-red-200",
  data_export: "bg-amber-100 text-amber-700 border-amber-200",
  api: "bg-violet-100 text-violet-700 border-violet-200",
};

// Severity configurations
const severityConfig: Record<AuditSeverity, { icon: React.ElementType; color: string; bgColor: string }> = {
  info: { icon: Info, color: "text-blue-600", bgColor: "bg-blue-100" },
  warning: { icon: AlertTriangle, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  error: { icon: AlertCircle, color: "text-orange-600", bgColor: "bg-orange-100" },
  critical: { icon: Shield, color: "text-red-600", bgColor: "bg-red-100" },
};

// Status configurations
const statusConfig: Record<AuditStatus, { icon: React.ElementType; color: string }> = {
  success: { icon: CheckCircle, color: "text-green-600" },
  failure: { icon: XCircle, color: "text-red-600" },
  pending: { icon: Clock, color: "text-yellow-600" },
  partial: { icon: AlertTriangle, color: "text-orange-600" },
};

// Date range presets
const datePresets = [
  { label: "Today", value: "today" },
  { label: "Yesterday", value: "yesterday" },
  { label: "Last 7 days", value: "7days" },
  { label: "Last 30 days", value: "30days" },
  { label: "Last 90 days", value: "90days" },
  { label: "All time", value: "all" },
];

export default function AuditTrailPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<AuditCategory[]>([]);
  const [selectedSeverities, setSelectedSeverities] = useState<AuditSeverity[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<AuditStatus[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [dateRange, setDateRange] = useState("7days");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [liveMode, setLiveMode] = useState(false);
  const pageSize = 25;

  // Load audit logs
  useEffect(() => {
    seedAuditLogs();
    const allLogs = getAllAuditLogs();
    setLogs(allLogs);
    setLoading(false);
  }, []);

  // Live mode - refresh every 5 seconds
  useEffect(() => {
    if (!liveMode) return;

    const interval = setInterval(() => {
      const allLogs = getAllAuditLogs();
      setLogs(allLogs);
    }, 5000);

    return () => clearInterval(interval);
  }, [liveMode]);

  // Get unique users from logs
  const users = useMemo(() => {
    const userMap = new Map<string, { id: string; name: string; email: string }>();
    logs.forEach((log) => {
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, {
          id: log.userId,
          name: log.userName,
          email: log.userEmail,
        });
      }
    });
    return Array.from(userMap.values());
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    let filtered = [...logs];

    // Date filter
    const now = new Date();
    if (dateRange !== "all") {
      let startDate: Date;
      switch (dateRange) {
        case "today":
          startDate = startOfDay(now);
          break;
        case "yesterday":
          startDate = startOfDay(subDays(now, 1));
          break;
        case "7days":
          startDate = subDays(now, 7);
          break;
        case "30days":
          startDate = subDays(now, 30);
          break;
        case "90days":
          startDate = subDays(now, 90);
          break;
        default:
          startDate = subDays(now, 7);
      }
      filtered = filtered.filter((log) => new Date(log.timestamp) >= startDate);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.description.toLowerCase().includes(query) ||
          log.userName.toLowerCase().includes(query) ||
          log.userEmail.toLowerCase().includes(query) ||
          log.action.toLowerCase().includes(query) ||
          log.resource?.name?.toLowerCase().includes(query) ||
          log.ipAddress.includes(query)
      );
    }

    // Category filter
    if (selectedCategories.length > 0) {
      filtered = filtered.filter((log) => selectedCategories.includes(log.category));
    }

    // Severity filter
    if (selectedSeverities.length > 0) {
      filtered = filtered.filter((log) => selectedSeverities.includes(log.severity));
    }

    // Status filter
    if (selectedStatuses.length > 0) {
      filtered = filtered.filter((log) => selectedStatuses.includes(log.status));
    }

    // User filter
    if (selectedUser !== "all") {
      filtered = filtered.filter((log) => log.userId === selectedUser);
    }

    return filtered;
  }, [logs, searchQuery, selectedCategories, selectedSeverities, selectedStatuses, selectedUser, dateRange]);

  // Paginated logs
  const paginatedLogs = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, page]);

  const totalPages = Math.ceil(filteredLogs.length / pageSize);

  // Statistics
  const stats = useMemo(() => {
    const categoryCount: Record<string, number> = {};
    const severityCount: Record<string, number> = {};
    const statusCount: Record<string, number> = {};
    const userCount: Record<string, number> = {};

    filteredLogs.forEach((log) => {
      categoryCount[log.category] = (categoryCount[log.category] || 0) + 1;
      severityCount[log.severity] = (severityCount[log.severity] || 0) + 1;
      statusCount[log.status] = (statusCount[log.status] || 0) + 1;
      userCount[log.userId] = (userCount[log.userId] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const criticalEvents = filteredLogs.filter((l) => l.severity === "critical" || l.severity === "error");
    const failedEvents = filteredLogs.filter((l) => l.status === "failure");

    return {
      total: filteredLogs.length,
      categoryCount,
      severityCount,
      statusCount,
      topCategories,
      criticalEvents: criticalEvents.length,
      failedEvents: failedEvents.length,
      uniqueUsers: Object.keys(userCount).length,
    };
  }, [filteredLogs]);

  // Export logs
  const handleExport = (format: "csv" | "json") => {
    const dataToExport = filteredLogs.map((log) => ({
      timestamp: format === "csv" ? log.timestamp.toISOString() : log.timestamp,
      user: log.userName,
      email: log.userEmail,
      role: log.userRole,
      category: log.category,
      action: log.action,
      description: log.description,
      resource: log.resource?.name || "",
      status: log.status,
      severity: log.severity,
      ipAddress: log.ipAddress,
      browser: log.userAgentInfo?.browser || "",
      os: log.userAgentInfo?.os || "",
    }));

    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === "csv") {
      const headers = Object.keys(dataToExport[0]).join(",");
      const rows = dataToExport.map((row) =>
        Object.values(row)
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      content = [headers, ...rows].join("\n");
      filename = `audit-log-${format}-${Date.now()}.csv`;
      mimeType = "text/csv";
    } else {
      content = JSON.stringify(dataToExport, null, 2);
      filename = `audit-log-${format}-${Date.now()}.json`;
      mimeType = "application/json";
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCategories([]);
    setSelectedSeverities([]);
    setSelectedStatuses([]);
    setSelectedUser("all");
    setDateRange("7days");
    setPage(1);
  };

  const hasActiveFilters =
    searchQuery ||
    selectedCategories.length > 0 ||
    selectedSeverities.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedUser !== "all";

  return (
    <>
      <Header title="Audit Trail" />
      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Events</p>
                  <p className="text-3xl font-bold">{stats.total.toLocaleString()}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unique Users</p>
                  <p className="text-3xl font-bold">{stats.uniqueUsers}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Critical/Error Events</p>
                  <p className="text-3xl font-bold text-red-600">{stats.criticalEvents}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Failed Actions</p>
                  <p className="text-3xl font-bold text-orange-600">{stats.failedEvents}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="logs" className="space-y-4">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="logs">Event Log</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="alerts">Security Alerts</TabsTrigger>
              <TabsTrigger value="sessions">User Sessions</TabsTrigger>
            </TabsList>

            <div className="flex items-center gap-2">
              <Button
                variant={liveMode ? "default" : "outline"}
                size="sm"
                onClick={() => setLiveMode(!liveMode)}
                className={liveMode ? "bg-green-600 hover:bg-green-700" : ""}
              >
                <Activity className={cn("h-4 w-4 mr-2", liveMode && "animate-pulse")} />
                {liveMode ? "Live" : "Live Mode"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    Export as CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("json")}>
                    Export as JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <TabsContent value="logs" className="space-y-4">
            {/* Search and Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    {/* Search */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by user, action, resource, IP address..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>

                    {/* Date Range */}
                    <Select value={dateRange} onValueChange={setDateRange}>
                      <SelectTrigger className="w-40">
                        <Calendar className="h-4 w-4 mr-2" />
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {datePresets.map((preset) => (
                          <SelectItem key={preset.value} value={preset.value}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* User Filter */}
                    <Select value={selectedUser} onValueChange={setSelectedUser}>
                      <SelectTrigger className="w-48">
                        <User className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="All Users" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Toggle Filters */}
                    <Button
                      variant={showFilters ? "secondary" : "outline"}
                      size="icon"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4" />
                    </Button>

                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Clear Filters
                      </Button>
                    )}
                  </div>

                  {/* Expanded Filters */}
                  {showFilters && (
                    <div className="grid grid-cols-3 gap-6 pt-4 border-t">
                      {/* Category Filters */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Categories</h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {(Object.keys(categoryColors) as AuditCategory[]).map((category) => (
                            <label key={category} className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={selectedCategories.includes(category)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedCategories([...selectedCategories, category]);
                                  } else {
                                    setSelectedCategories(selectedCategories.filter((c) => c !== category));
                                  }
                                }}
                              />
                              <span className="text-sm capitalize">{category.replace("_", " ")}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Severity Filters */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Severity</h4>
                        <div className="space-y-2">
                          {(Object.keys(severityConfig) as AuditSeverity[]).map((severity) => {
                            const config = severityConfig[severity];
                            const Icon = config.icon;
                            return (
                              <label key={severity} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={selectedSeverities.includes(severity)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedSeverities([...selectedSeverities, severity]);
                                    } else {
                                      setSelectedSeverities(selectedSeverities.filter((s) => s !== severity));
                                    }
                                  }}
                                />
                                <Icon className={cn("h-4 w-4", config.color)} />
                                <span className="text-sm capitalize">{severity}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Status Filters */}
                      <div>
                        <h4 className="text-sm font-medium mb-3">Status</h4>
                        <div className="space-y-2">
                          {(Object.keys(statusConfig) as AuditStatus[]).map((status) => {
                            const config = statusConfig[status];
                            const Icon = config.icon;
                            return (
                              <label key={status} className="flex items-center gap-2 cursor-pointer">
                                <Checkbox
                                  checked={selectedStatuses.includes(status)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedStatuses([...selectedStatuses, status]);
                                    } else {
                                      setSelectedStatuses(selectedStatuses.filter((s) => s !== status));
                                    }
                                  }}
                                />
                                <Icon className={cn("h-4 w-4", config.color)} />
                                <span className="text-sm capitalize">{status}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Logs Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Timestamp</TableHead>
                      <TableHead className="w-[200px]">User</TableHead>
                      <TableHead className="w-[120px]">Category</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[80px]">Severity</TableHead>
                      <TableHead className="w-[120px]">IP Address</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                          Loading audit logs...
                        </TableCell>
                      </TableRow>
                    ) : paginatedLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No audit logs found matching your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedLogs.map((log) => {
                        const CategoryIcon = categoryIcons[log.category];
                        const StatusIcon = statusConfig[log.status].icon;
                        const SeverityIcon = severityConfig[log.severity].icon;

                        return (
                          <TableRow
                            key={log.id}
                            className="cursor-pointer hover:bg-muted/50"
                            onClick={() => setSelectedLog(log)}
                          >
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-medium">
                                  {format(new Date(log.timestamp), "MMM d, yyyy")}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(log.timestamp), "HH:mm:ss")}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarFallback className="text-xs">
                                    {log.userName
                                      .split(" ")
                                      .map((n) => n[0])
                                      .join("")}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">{log.userName}</p>
                                  <p className="text-xs text-muted-foreground">{log.userRole}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("font-normal", categoryColors[log.category])}>
                                <CategoryIcon className="h-3 w-3 mr-1" />
                                {log.category.replace("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm">{log.description}</p>
                                {log.resource && (
                                  <p className="text-xs text-muted-foreground">
                                    {log.resource.type}: {log.resource.name || log.resource.id}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <StatusIcon className={cn("h-4 w-4", statusConfig[log.status].color)} />
                                <span className="text-sm capitalize">{log.status}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div
                                className={cn(
                                  "flex items-center justify-center h-6 w-6 rounded-full",
                                  severityConfig[log.severity].bgColor
                                )}
                              >
                                <SeverityIcon className={cn("h-3.5 w-3.5", severityConfig[log.severity].color)} />
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-mono text-muted-foreground">{log.ipAddress}</span>
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredLogs.length)} of{" "}
                    {filteredLogs.length} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (page <= 3) {
                          pageNum = i + 1;
                        } else if (page >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = page - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={page === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8"
                            onClick={() => setPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Activity by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Activity by Category</CardTitle>
                  <CardDescription>Distribution of events across categories</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stats.topCategories.map(([category, count]) => {
                      const CategoryIcon = categoryIcons[category as AuditCategory];
                      const percentage = Math.round((count / stats.total) * 100);
                      return (
                        <div key={category} className="flex items-center gap-4">
                          <div className="w-32 flex items-center gap-2">
                            <CategoryIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm capitalize">{category.replace("_", " ")}</span>
                          </div>
                          <div className="flex-1">
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                          <div className="w-16 text-right">
                            <span className="text-sm font-medium">{count}</span>
                            <span className="text-xs text-muted-foreground ml-1">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Activity by Severity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Events by Severity</CardTitle>
                  <CardDescription>Breakdown of event severity levels</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    {(Object.keys(severityConfig) as AuditSeverity[]).map((severity) => {
                      const config = severityConfig[severity];
                      const count = stats.severityCount[severity] || 0;
                      const Icon = config.icon;
                      return (
                        <div
                          key={severity}
                          className={cn("p-4 rounded-lg border", config.bgColor)}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={cn("h-5 w-5", config.color)} />
                            <span className="font-medium capitalize">{severity}</span>
                          </div>
                          <p className="text-2xl font-bold">{count}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Top Users */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Most Active Users</CardTitle>
                  <CardDescription>Users with the most recorded actions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {users
                      .map((user) => ({
                        ...user,
                        count: filteredLogs.filter((l) => l.userId === user.id).length,
                      }))
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 5)
                      .map((user) => (
                        <div key={user.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{user.name}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                          <Badge variant="secondary">{user.count} events</Badge>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recent Critical Events */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Recent Critical Events</CardTitle>
                  <CardDescription>Events requiring attention</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredLogs
                      .filter((l) => l.severity === "critical" || l.severity === "error")
                      .slice(0, 5)
                      .map((log) => (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100"
                        >
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium">{log.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.userName} • {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    {filteredLogs.filter((l) => l.severity === "critical" || l.severity === "error").length === 0 && (
                      <div className="text-center py-4 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                        <p>No critical events in this period</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Security Alerts</CardTitle>
                <CardDescription>Failed logins, permission denials, and suspicious activity</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs
                      .filter((l) => l.category === "security" || l.action.includes("failed") || l.status === "failure")
                      .slice(0, 20)
                      .map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="text-sm">
                                {format(new Date(log.timestamp), "MMM d, HH:mm")}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7">
                                <AvatarFallback className="text-xs">
                                  {log.userName.split(" ").map((n) => n[0]).join("")}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">{log.userName}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="font-normal">
                              {log.action.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{log.ipAddress}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              Unknown
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Sessions</CardTitle>
                <CardDescription>Active and recent user sessions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {users.slice(0, 10).map((user) => {
                    const userLogs = filteredLogs.filter((l) => l.userId === user.id);
                    const lastActivity = userLogs[0];
                    const sessionsCount = new Set(userLogs.map((l) => l.sessionInfo?.sessionId)).size;

                    return (
                      <div key={user.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>
                              {user.name.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.name}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-center">
                            <p className="text-lg font-semibold">{sessionsCount}</p>
                            <p className="text-xs text-muted-foreground">Sessions</p>
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-semibold">{userLogs.length}</p>
                            <p className="text-xs text-muted-foreground">Actions</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">Last active</p>
                            <p className="text-xs text-muted-foreground">
                              {lastActivity
                                ? formatDistanceToNow(new Date(lastActivity.timestamp), { addSuffix: true })
                                : "No activity"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {lastActivity?.userAgentInfo?.isMobile ? (
                              <Smartphone className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Laptop className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="text-sm text-muted-foreground">
                              {lastActivity?.userAgentInfo?.browser || "Unknown"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Audit Log Details</DialogTitle>
            <DialogDescription>
              Event ID: {selectedLog?.id}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-6">
                {/* Event Summary */}
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50">
                  <div
                    className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center",
                      severityConfig[selectedLog.severity].bgColor
                    )}
                  >
                    {(() => {
                      const SeverityIcon = severityConfig[selectedLog.severity].icon;
                      return <SeverityIcon className={cn("h-5 w-5", severityConfig[selectedLog.severity].color)} />;
                    })()}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{selectedLog.description}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(selectedLog.timestamp), "MMMM d, yyyy 'at' h:mm:ss a")}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      selectedLog.status === "success"
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-red-100 text-red-700 border-red-200"
                    )}
                  >
                    {selectedLog.status}
                  </Badge>
                </div>

                <Separator />

                {/* User Information */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    User Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Name</p>
                      <p className="text-sm font-medium">{selectedLog.userName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{selectedLog.userEmail}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Role</p>
                      <p className="text-sm font-medium capitalize">{selectedLog.userRole}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">User ID</p>
                      <p className="text-sm font-mono">{selectedLog.userId}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Action Details */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Action Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Category</p>
                      <Badge variant="outline" className={cn("mt-1", categoryColors[selectedLog.category])}>
                        {selectedLog.category.replace("_", " ")}
                      </Badge>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Action</p>
                      <p className="text-sm font-medium">{selectedLog.action.replace("_", " ")}</p>
                    </div>
                    {selectedLog.resource && (
                      <>
                        <div>
                          <p className="text-xs text-muted-foreground">Resource Type</p>
                          <p className="text-sm font-medium capitalize">{selectedLog.resource.type}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Resource</p>
                          <p className="text-sm font-medium">
                            {selectedLog.resource.name || selectedLog.resource.id}
                          </p>
                        </div>
                      </>
                    )}
                    {selectedLog.requestPath && (
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Request Path</p>
                        <p className="text-sm font-mono">{selectedLog.requestPath}</p>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Technical Details */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    Technical Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">IP Address</p>
                      <p className="text-sm font-mono">{selectedLog.ipAddress}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Browser</p>
                      <p className="text-sm">
                        {selectedLog.userAgentInfo?.browser} {selectedLog.userAgentInfo?.browserVersion}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Operating System</p>
                      <p className="text-sm">
                        {selectedLog.userAgentInfo?.os} {selectedLog.userAgentInfo?.osVersion}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Device</p>
                      <p className="text-sm">{selectedLog.userAgentInfo?.device}</p>
                    </div>
                  </div>
                </div>

                {selectedLog.sessionInfo && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Session Information
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Session ID</p>
                          <p className="text-sm font-mono text-xs">{selectedLog.sessionInfo.sessionId}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Session Started</p>
                          <p className="text-sm">
                            {format(new Date(selectedLog.sessionInfo.startedAt), "MMM d, yyyy HH:mm")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {selectedLog.changes && selectedLog.changes.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Changes Made</h4>
                      <div className="space-y-2">
                        {selectedLog.changes.map((change, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-muted/50">
                            <p className="text-sm font-medium">{change.field}</p>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                              <div>
                                <p className="text-xs text-muted-foreground">Before</p>
                                <p className="text-sm font-mono">
                                  {change.masked ? "••••••" : String(change.oldValue)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">After</p>
                                <p className="text-sm font-mono">
                                  {change.masked ? "••••••" : String(change.newValue)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {selectedLog.errorMessage && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-semibold mb-3 text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Error Details
                      </h4>
                      <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-sm text-red-700">{selectedLog.errorMessage}</p>
                        {selectedLog.errorCode && (
                          <p className="text-xs text-red-500 mt-1">Error Code: {selectedLog.errorCode}</p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
