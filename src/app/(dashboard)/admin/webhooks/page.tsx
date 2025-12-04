"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Webhook,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Bot,
  Phone,
  AlertTriangle,
  ChevronRight,
  Loader2,
  Activity,
  Zap,
  FileJson,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

interface WebhookLog {
  id: string;
  endpoint: string;
  source: string | null;
  status: "received" | "parsing" | "parsed" | "stored" | "failed";
  httpMethod: string;
  headers: Record<string, string>;
  rawPayload: Record<string, unknown>;
  parsedData: Record<string, unknown> | null;
  aiParsingUsed: boolean;
  aiConfidence: number | null;
  errorMessage: string | null;
  processingTimeMs: number | null;
  resultCallId: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface WebhookStats {
  total: number;
  byStatus: {
    received: number;
    parsing: number;
    parsed: number;
    stored: number;
    failed: number;
  };
  avgProcessingTimeMs: number;
  aiParsedCount: number;
}

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  received: { bg: "bg-blue-100", text: "text-blue-700", icon: <Clock className="h-3 w-3" /> },
  parsing: { bg: "bg-amber-100", text: "text-amber-700", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  parsed: { bg: "bg-purple-100", text: "text-purple-700", icon: <Bot className="h-3 w-3" /> },
  stored: { bg: "bg-green-100", text: "text-green-700", icon: <CheckCircle className="h-3 w-3" /> },
  failed: { bg: "bg-red-100", text: "text-red-700", icon: <XCircle className="h-3 w-3" /> },
};

export default function WebhookMonitorPage() {
  const [logs, setLogs] = useState<WebhookLog[]>([]);
  const [stats, setStats] = useState<WebhookStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "all") {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/webhooks/monitor?${params}`);
      const data = await response.json();

      if (data.success) {
        setLogs(data.data.logs);
        setStats(data.data.stats);
      }
    } catch (error) {
      console.error("Failed to fetch webhook logs:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, fetchLogs]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Header title="Webhook Monitor" />
      <main className="p-6 space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Webhook className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                  <p className="text-xs text-muted-foreground">Total Webhooks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.byStatus.stored || 0}</p>
                  <p className="text-xs text-muted-foreground">Stored</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.byStatus.failed || 0}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                  <Bot className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.aiParsedCount || 0}</p>
                  <p className="text-xs text-muted-foreground">AI Parsed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats?.avgProcessingTimeMs || 0}ms</p>
                  <p className="text-xs text-muted-foreground">Avg Processing</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="received">Received</SelectItem>
              <SelectItem value="parsing">Parsing</SelectItem>
              <SelectItem value="parsed">Parsed</SelectItem>
              <SelectItem value="stored">Stored</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={cn("h-4 w-4 mr-2", autoRefresh && "animate-pulse")} />
            {autoRefresh ? "Live" : "Auto-refresh"}
          </Button>

          <Button variant="outline" size="sm" onClick={fetchLogs}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {/* Webhook Logs Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Recent Webhook Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {loading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
                    <p>Loading webhook logs...</p>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Webhook className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium">No webhook logs yet</p>
                    <p className="text-sm">Webhooks will appear here when received</p>
                  </div>
                ) : (
                  logs.map((log) => {
                    const statusStyle = statusColors[log.status];
                    return (
                      <div
                        key={log.id}
                        className="p-4 hover:bg-muted/50 cursor-pointer transition-colors"
                        onClick={() => setSelectedLog(log)}
                      >
                        <div className="flex items-center gap-4">
                          {/* Status */}
                          <Badge
                            variant="secondary"
                            className={cn("gap-1", statusStyle.bg, statusStyle.text)}
                          >
                            {statusStyle.icon}
                            {log.status}
                          </Badge>

                          {/* Endpoint & Source */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{log.endpoint}</span>
                              {log.source && (
                                <Badge variant="outline" className="text-xs">
                                  {log.source}
                                </Badge>
                              )}
                              {log.aiParsingUsed && (
                                <Badge className="bg-purple-100 text-purple-700 text-xs gap-1">
                                  <Bot className="h-3 w-3" />
                                  AI {log.aiConfidence}%
                                </Badge>
                              )}
                            </div>
                            {log.errorMessage && (
                              <p className="text-xs text-red-600 mt-1 truncate">
                                {log.errorMessage}
                              </p>
                            )}
                          </div>

                          {/* Result */}
                          {log.resultCallId && (
                            <Badge variant="secondary" className="gap-1 bg-green-50 text-green-700">
                              <Phone className="h-3 w-3" />
                              Call Created
                            </Badge>
                          )}

                          {/* Processing Time */}
                          {log.processingTimeMs && (
                            <span className="text-xs text-muted-foreground">
                              {log.processingTimeMs}ms
                            </span>
                          )}

                          {/* Time */}
                          <span className="text-xs text-muted-foreground w-24 text-right">
                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true })}
                          </span>

                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail Modal */}
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="h-5 w-5" />
                Webhook Details
                {selectedLog && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "ml-2",
                      statusColors[selectedLog.status].bg,
                      statusColors[selectedLog.status].text
                    )}
                  >
                    {statusColors[selectedLog.status].icon}
                    {selectedLog.status}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {selectedLog && (
              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-6 pb-4">
                  {/* Metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Endpoint</p>
                      <p className="font-mono text-sm">{selectedLog.endpoint}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Source</p>
                      <p className="text-sm">{selectedLog.source || "Unknown"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Processing Time</p>
                      <p className="text-sm">{selectedLog.processingTimeMs || 0}ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Received</p>
                      <p className="text-sm">
                        {format(new Date(selectedLog.createdAt), "MMM d, yyyy h:mm:ss a")}
                      </p>
                    </div>
                  </div>

                  {/* AI Parsing Info */}
                  {selectedLog.aiParsingUsed && (
                    <Card className="bg-purple-50 border-purple-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Bot className="h-4 w-4 text-purple-600" />
                          AI Parsing Results
                          <Badge className="ml-auto bg-purple-100 text-purple-700">
                            {selectedLog.aiConfidence}% confidence
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <pre className="text-xs bg-white/50 p-3 rounded overflow-x-auto">
                          {JSON.stringify(selectedLog.parsedData, null, 2)}
                        </pre>
                      </CardContent>
                    </Card>
                  )}

                  {/* Error Message */}
                  {selectedLog.errorMessage && (
                    <Card className="bg-red-50 border-red-200">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                          <AlertTriangle className="h-4 w-4" />
                          Error
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-red-700">{selectedLog.errorMessage}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Raw Payload */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <FileJson className="h-4 w-4" />
                          Raw Payload
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(JSON.stringify(selectedLog.rawPayload, null, 2))
                          }
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-[300px]">
                        {JSON.stringify(selectedLog.rawPayload, null, 2)}
                      </pre>
                    </CardContent>
                  </Card>

                  {/* Headers */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Request Headers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-1">
                        {Object.entries(selectedLog.headers || {}).map(([key, value]) => (
                          <div key={key} className="flex gap-2 text-xs">
                            <span className="font-mono text-muted-foreground w-48 truncate">
                              {key}:
                            </span>
                            <span className="font-mono truncate">{value}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Result Call Link */}
                  {selectedLog.resultCallId && (
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Phone className="h-5 w-5 text-green-600" />
                            <span className="font-medium">Call record created</span>
                          </div>
                          <Badge variant="outline" className="font-mono">
                            {selectedLog.resultCallId}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
