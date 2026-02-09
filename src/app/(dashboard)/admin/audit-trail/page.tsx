"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  Download,
  Eye,
  Phone,
  Mail,
  FileText,
  Users,
  Activity,
  TrendingUp,
  Calendar,
  Filter,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface AuditStats {
  totalActivities: number;
  todayCount: number;
  weekCount: number;
  monthCount: number;
  byType: Record<string, number>;
  topUsers: Array<{ userId: string; userEmail: string; count: number }>;
}

interface AuditLog {
  id: string;
  type: string;
  description: string;
  userId: string | null;
  userEmail?: string;
  ipAddress: string | null;
  createdAt: string;
  metadata?: Record<string, any>;
}

export default function AuditTrailPage() {
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState<string>("all");
  const [filterUser, setFilterUser] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Fetch audit stats and logs
  useEffect(() => {
    fetchAuditData();
  }, [filterType, filterUser, startDate, endDate]);

  const fetchAuditData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "all") params.append("type", filterType);
      if (filterUser) params.append("userId", filterUser);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`/api/audit/logs?${params.toString()}`);

      if (!response.ok) throw new Error("Failed to fetch audit data");

      const data = await response.json();
      setStats(data.stats);
      setLogs(data.logs || []);
    } catch (error) {
      console.error("Error fetching audit data:", error);
      toast.error("Failed to load audit data");
    } finally {
      setIsLoading(false);
    }
  };

  // Export audit logs
  const handleExport = async (format: "csv" | "pdf") => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({ format });
      if (filterType !== "all") params.append("type", filterType);
      if (filterUser) params.append("userId", filterUser);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const response = await fetch(`/api/audit/export?${params.toString()}`);

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${format}-${Date.now()}.${format === "pdf" ? "html" : "csv"}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`Audit log exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export audit logs");
    } finally {
      setIsExporting(false);
    }
  };

  // Get badge color for activity type
  const getActivityBadge = (type: string) => {
    const colors: Record<string, string> = {
      call_viewed: "bg-blue-100 text-blue-700",
      call_received: "bg-blue-100 text-blue-700",
      email_viewed: "bg-purple-100 text-purple-700",
      email_received: "bg-purple-100 text-purple-700",
      recording_played: "bg-orange-100 text-orange-700",
      task_created: "bg-green-100 text-green-700",
      task_updated: "bg-yellow-100 text-yellow-700",
      task_completed: "bg-green-100 text-green-700",
      client_created: "bg-indigo-100 text-indigo-700",
      client_updated: "bg-indigo-100 text-indigo-700",
    };

    return colors[type] || "bg-gray-100 text-gray-700";
  };

  return (
    <>
      <Header title="Audit Trail" />
      <main className="p-6 space-y-6">
        {/* Header Stats */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalActivities.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">All time</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todayCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 24 hours</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Week</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.weekCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.monthCount.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Last 30 days</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters & Export */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filters & Export
                </CardTitle>
                <CardDescription>Filter and export audit logs for compliance</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("csv")}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("pdf")}
                  disabled={isExporting}
                >
                  {isExporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Export PDF
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="activity-type">Activity Type</Label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger id="activity-type">
                    <SelectValue placeholder="All Activities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activities</SelectItem>
                    <SelectItem value="call_viewed">Call Viewed</SelectItem>
                    <SelectItem value="email_viewed">Email Viewed</SelectItem>
                    <SelectItem value="recording_played">Recording Played</SelectItem>
                    <SelectItem value="task_updated">Task Updated</SelectItem>
                    <SelectItem value="task_completed">Task Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setFilterType("all");
                    setStartDate("");
                    setEndDate("");
                    setFilterUser("");
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Audit Log Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Showing {logs.length} audit log entries</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No audit logs found for the selected filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className={getActivityBadge(log.type)}>{log.type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm font-medium truncate">{log.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        {log.userEmail && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {log.userEmail}
                          </span>
                        )}
                        {log.ipAddress && (
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {log.ipAddress}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
