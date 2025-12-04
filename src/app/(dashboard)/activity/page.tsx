"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Search,
  Download,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  UserPlus,
  MessageSquare,
  Clock,
  Activity,
  PhoneIncoming,
  PhoneOutgoing,
  MailOpen,
  Send,
  Loader2,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// Activity type from API
interface ActivityLog {
  id: string;
  created_at: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
}

interface ActivityStats {
  calls: number;
  emails: number;
  documents: number;
  tasksCompleted: number;
}

const actionIcons: Record<string, { icon: any; bg: string; color: string }> = {
  created: { icon: Plus, bg: "bg-green-100", color: "text-green-600" },
  updated: { icon: Edit, bg: "bg-blue-100", color: "text-blue-600" },
  deleted: { icon: Trash2, bg: "bg-red-100", color: "text-red-600" },
  completed: { icon: CheckCircle, bg: "bg-green-100", color: "text-green-600" },
  viewed: { icon: Eye, bg: "bg-gray-100", color: "text-gray-600" },
  call_received: { icon: PhoneIncoming, bg: "bg-green-100", color: "text-green-600" },
  call_made: { icon: PhoneOutgoing, bg: "bg-blue-100", color: "text-blue-600" },
  email_received: { icon: MailOpen, bg: "bg-purple-100", color: "text-purple-600" },
  email_sent: { icon: Send, bg: "bg-indigo-100", color: "text-indigo-600" },
};

const resourceTypeIcons: Record<string, { icon: any; bg: string; color: string }> = {
  task: { icon: Clock, bg: "bg-yellow-100", color: "text-yellow-600" },
  client: { icon: UserPlus, bg: "bg-accent/20", color: "text-accent-foreground" },
  email: { icon: Mail, bg: "bg-purple-100", color: "text-purple-600" },
  call: { icon: Phone, bg: "bg-green-100", color: "text-green-600" },
  document: { icon: FileText, bg: "bg-orange-100", color: "text-orange-600" },
  note: { icon: MessageSquare, bg: "bg-gray-100", color: "text-gray-600" },
};

const actionLabels: Record<string, string> = {
  created: "Created",
  updated: "Updated",
  deleted: "Deleted",
  completed: "Completed",
  viewed: "Viewed",
  call_received: "Received",
  call_made: "Made",
  email_received: "Received",
  email_sent: "Sent",
};

const ITEMS_PER_PAGE = 20;

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<ActivityStats>({ calls: 0, emails: 0, documents: 0, tasksCompleted: 0 });

  // Filters
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Fetch activities
  const fetchActivities = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (resourceTypeFilter !== "all") params.set("resourceType", resourceTypeFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (searchQuery) params.set("search", searchQuery);
      params.set("limit", ITEMS_PER_PAGE.toString());
      params.set("offset", ((page - 1) * ITEMS_PER_PAGE).toString());

      const response = await fetch(`/api/activity?${params}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setTotalCount(data.count || 0);
      }
    } catch (error) {
      console.error("Error fetching activities:", error);
      toast.error("Failed to load activity log");
    } finally {
      setLoading(false);
    }
  }, [resourceTypeFilter, actionFilter, searchQuery, page]);

  // Fetch stats (count activities by type for today)
  const fetchStats = useCallback(async () => {
    try {
      // Fetch today's stats using the activity API with different filters
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [callsRes, emailsRes, docsRes, tasksRes] = await Promise.all([
        fetch(`/api/activity?resourceType=call&limit=1000`),
        fetch(`/api/activity?resourceType=email&limit=1000`),
        fetch(`/api/activity?resourceType=document&limit=1000`),
        fetch(`/api/activity?resourceType=task&action=completed&limit=1000`),
      ]);

      const [callsData, emailsData, docsData, tasksData] = await Promise.all([
        callsRes.json(),
        emailsRes.json(),
        docsRes.json(),
        tasksRes.json(),
      ]);

      // Count today's activities
      const countToday = (items: ActivityLog[]) => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return items?.filter(a => new Date(a.created_at) >= todayStart).length || 0;
      };

      setStats({
        calls: countToday(callsData.activities),
        emails: countToday(emailsData.activities),
        documents: countToday(docsData.activities),
        tasksCompleted: countToday(tasksData.activities),
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    fetchStats();
  }, [fetchActivities, fetchStats]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [resourceTypeFilter, actionFilter, searchQuery]);

  const handleExport = () => {
    // Create CSV from current activities
    const headers = ["Timestamp", "Action", "Resource Type", "Resource Name", "User", "Details"];
    const rows = activities.map(a => [
      format(new Date(a.created_at), "yyyy-MM-dd HH:mm:ss"),
      a.action,
      a.resource_type,
      a.resource_name || "",
      a.user_email || "",
      JSON.stringify(a.details || {}),
    ]);

    const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `activity-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Activity log exported");
  };

  const getIconConfig = (activity: ActivityLog) => {
    // First check for action-specific icon
    if (actionIcons[activity.action]) {
      return actionIcons[activity.action];
    }
    // Fall back to resource type icon
    if (resourceTypeIcons[activity.resource_type]) {
      return resourceTypeIcons[activity.resource_type];
    }
    // Default
    return { icon: Activity, bg: "bg-gray-100", color: "text-gray-600" };
  };

  const getActivityDescription = (activity: ActivityLog) => {
    const action = actionLabels[activity.action] || activity.action;
    const resourceType = activity.resource_type.charAt(0).toUpperCase() + activity.resource_type.slice(1);
    const resourceName = activity.resource_name ? `"${activity.resource_name}"` : "";
    return `${action} ${resourceType} ${resourceName}`.trim();
  };

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  return (
    <>
      <Header title="Activity Log" />
      <main className="p-6 space-y-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Phone className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Calls Today</p>
                <p className="text-2xl font-bold">{stats.calls}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Mail className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Emails Processed</p>
                <p className="text-2xl font-bold">{stats.emails}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Documents</p>
                <p className="text-2xl font-bold">{stats.documents}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tasks Completed</p>
                <p className="text-2xl font-bold">{stats.tasksCompleted}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Activity Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Activity Log
            </CardTitle>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>

              {/* Resource Type Filter */}
              <Select value={resourceTypeFilter} onValueChange={setResourceTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Resource Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="task">Tasks</SelectItem>
                  <SelectItem value="client">Clients</SelectItem>
                  <SelectItem value="email">Emails</SelectItem>
                  <SelectItem value="call">Calls</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                </SelectContent>
              </Select>

              {/* Action Filter */}
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="updated">Updated</SelectItem>
                  <SelectItem value="deleted">Deleted</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh */}
              <Button variant="outline" size="icon" onClick={() => { fetchActivities(); fetchStats(); }}>
                <RefreshCw className="h-4 w-4" />
              </Button>

              {/* Export */}
              <Button variant="outline" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No activities found</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery || resourceTypeFilter !== "all" || actionFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Activity will appear here as you use the system"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">Type</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => {
                    const iconConfig = getIconConfig(activity);
                    const Icon = iconConfig.icon;

                    return (
                      <TableRow key={activity.id}>
                        <TableCell>
                          <div
                            className={cn(
                              "w-9 h-9 rounded-full flex items-center justify-center",
                              iconConfig.bg
                            )}
                          >
                            <Icon className={cn("h-4 w-4", iconConfig.color)} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs capitalize">
                                {activity.action}
                              </Badge>
                              <Badge variant="secondary" className="text-xs capitalize">
                                {activity.resource_type}
                              </Badge>
                            </div>
                            <p className="text-sm">{getActivityDescription(activity)}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-xs bg-muted">
                                {activity.user_email
                                  ? activity.user_email.charAt(0).toUpperCase()
                                  : "?"}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate max-w-[150px]">
                              {activity.user_email || "System"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {activity.resource_name ? (
                            <span className="text-sm font-medium text-primary truncate max-w-[150px] block">
                              {activity.resource_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {activity.details && Object.keys(activity.details).length > 0 ? (
                            <div className="text-xs text-muted-foreground max-w-[200px]">
                              {Object.entries(activity.details).map(([key, value]) => (
                                <div key={key} className="truncate">
                                  <span className="font-medium">{key}:</span>{" "}
                                  {typeof value === "object" ? JSON.stringify(value) : String(value)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {format(new Date(activity.created_at), "MMM d, h:mm a")}
                          </div>
                          <div className="text-xs text-muted-foreground" suppressHydrationWarning>
                            {formatDistanceToNow(new Date(activity.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {activities.length > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((page - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(page * ITEMS_PER_PAGE, totalCount)} of {totalCount} entries
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    Previous
                  </Button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <Button
                        key={pageNum}
                        variant="outline"
                        size="sm"
                        className={cn(page === pageNum && "bg-primary text-primary-foreground")}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
