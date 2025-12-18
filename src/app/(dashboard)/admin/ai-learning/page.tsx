"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sparkles,
  Brain,
  TrendingUp,
  CheckCircle,
  XCircle,
  RefreshCw,
  Phone,
  Mail,
  User,
  Clock,
  Target,
  Activity,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

interface AIStats {
  totalAITasks: number;
  completedTasks: number;
  dismissedTasks: number;
  pendingTasks: number;
  completionRate: number;
  avgTimeToActionMinutes: number;
  tasksBySource: Record<string, number>;
  tasksByCategory: Record<string, number>;
  recentFeedback: Array<{
    id: string;
    task_id: string;
    feedback_type: string;
    was_correct: boolean;
    created_at: string;
  }>;
}

interface PatternSummary {
  totalPatterns: number;
  summary: Record<string, Record<string, number>>;
}

export default function AILearningPage() {
  const [stats, setStats] = useState<AIStats | null>(null);
  const [patterns, setPatterns] = useState<PatternSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    else setRefreshing(true);

    try {
      const [statsRes, patternsRes] = await Promise.all([
        fetch("/api/ai-learning?stats=true"),
        fetch("/api/ai-learning?patterns=true"),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats);
      }

      if (patternsRes.ok) {
        const data = await patternsRes.json();
        setPatterns({
          totalPatterns: data.totalPatterns,
          summary: data.summary,
        });
      }
    } catch (error) {
      console.error("Error loading AI learning data:", error);
      toast.error("Failed to load AI learning data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getSourceIcon = (source: string) => {
    if (source.includes("phone")) return Phone;
    if (source.includes("email")) return Mail;
    return Activity;
  };

  const getAccuracyColor = (rate: number) => {
    if (rate >= 80) return "text-green-600";
    if (rate >= 60) return "text-yellow-600";
    return "text-orange-600";
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Header title="AI Learning" />
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Header title="AI Learning" />
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">AI Learning Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Monitor and train the AI task management system
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => loadData(false)}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {/* Stats Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  Total AI Tasks
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats?.totalAITasks || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Tasks created by AI analysis
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                  Completion Rate
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className={cn("text-3xl font-bold", getAccuracyColor(stats?.completionRate || 0))}>
                  {stats?.completionRate || 0}%
                </div>
                <Progress
                  value={stats?.completionRate || 0}
                  className="mt-2 h-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.completedTasks || 0} completed / {stats?.dismissedTasks || 0} dismissed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  Avg Time to Action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {stats?.avgTimeToActionMinutes
                    ? stats.avgTimeToActionMinutes < 60
                      ? `${Math.round(stats.avgTimeToActionMinutes)}m`
                      : `${Math.round(stats.avgTimeToActionMinutes / 60)}h`
                    : "N/A"}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Average time from creation to first action
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  Assignment Patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{patterns?.totalPatterns || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Learned routing patterns
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="patterns">Assignment Patterns</TabsTrigger>
              <TabsTrigger value="sources">By Source</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tasks by Category */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Tasks by Category
                    </CardTitle>
                    <CardDescription>
                      Distribution of AI-generated tasks by category
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats?.tasksByCategory && Object.keys(stats.tasksByCategory).length > 0 ? (
                      <div className="space-y-3">
                        {Object.entries(stats.tasksByCategory)
                          .sort(([, a], [, b]) => b - a)
                          .slice(0, 8)
                          .map(([category, count]) => {
                            const total = Object.values(stats.tasksByCategory).reduce((a, b) => a + b, 0);
                            const percentage = Math.round((count / total) * 100);
                            return (
                              <div key={category} className="space-y-1">
                                <div className="flex items-center justify-between text-sm">
                                  <span className="capitalize">{category.replace(/_/g, " ")}</span>
                                  <span className="text-muted-foreground">{count} ({percentage}%)</span>
                                </div>
                                <Progress value={percentage} className="h-2" />
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No category data yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Tasks by Source */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      Tasks by Source
                    </CardTitle>
                    <CardDescription>
                      Where AI tasks are coming from
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {stats?.tasksBySource && Object.keys(stats.tasksBySource).length > 0 ? (
                      <div className="space-y-4">
                        {Object.entries(stats.tasksBySource)
                          .sort(([, a], [, b]) => b - a)
                          .map(([source, count]) => {
                            const Icon = getSourceIcon(source);
                            const total = Object.values(stats.tasksBySource).reduce((a, b) => a + b, 0);
                            const percentage = Math.round((count / total) * 100);
                            return (
                              <div key={source} className="flex items-center gap-3">
                                <div className={cn(
                                  "p-2 rounded-lg",
                                  source.includes("phone") ? "bg-blue-100" : "bg-green-100"
                                )}>
                                  <Icon className={cn(
                                    "h-4 w-4",
                                    source.includes("phone") ? "text-blue-600" : "text-green-600"
                                  )} />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium capitalize">
                                      {source.replace(/_/g, " ")}
                                    </span>
                                    <span className="text-sm text-muted-foreground">{count}</span>
                                  </div>
                                  <Progress value={percentage} className="h-1.5 mt-1" />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                        <p className="text-sm text-muted-foreground">No source data yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Status Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Task Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-green-700">{stats?.completedTasks || 0}</div>
                      <div className="text-sm text-green-600">Completed</div>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                      <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-yellow-700">{stats?.pendingTasks || 0}</div>
                      <div className="text-sm text-yellow-600">Pending</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                      <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
                      <div className="text-2xl font-bold text-red-700">{stats?.dismissedTasks || 0}</div>
                      <div className="text-sm text-red-600">Dismissed</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patterns" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    Learned Assignment Patterns
                  </CardTitle>
                  <CardDescription>
                    The AI learns who typically handles tasks from different sources and categories.
                    These patterns are used to suggest assignees for new tasks.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {patterns?.summary && Object.keys(patterns.summary).length > 0 ? (
                    <ScrollArea className="h-[400px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source / Category</TableHead>
                            <TableHead>Top Assignees</TableHead>
                            <TableHead className="text-right">Total Assignments</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(patterns.summary).map(([key, assignees]) => {
                            const [source, category] = key.split("/");
                            const totalAssignments = Object.values(assignees).reduce((a, b) => a + b, 0);
                            const sortedAssignees = Object.entries(assignees)
                              .sort(([, a], [, b]) => b - a)
                              .slice(0, 3);

                            return (
                              <TableRow key={key}>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    {source === "phone_call" ? (
                                      <Phone className="h-4 w-4 text-blue-600" />
                                    ) : (
                                      <Mail className="h-4 w-4 text-green-600" />
                                    )}
                                    <div>
                                      <div className="font-medium capitalize">
                                        {source.replace(/_/g, " ")}
                                      </div>
                                      <div className="text-xs text-muted-foreground capitalize">
                                        {category || "General"}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {sortedAssignees.map(([userId, count], index) => (
                                      <Badge
                                        key={userId}
                                        variant={index === 0 ? "default" : "outline"}
                                        className="text-xs"
                                      >
                                        <User className="h-3 w-3 mr-1" />
                                        {Math.round((count / totalAssignments) * 100)}%
                                      </Badge>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className="font-medium">{totalAssignments}</span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <Brain className="h-12 w-12 text-muted-foreground/20 mb-4" />
                      <h3 className="text-lg font-medium mb-2">No patterns learned yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md">
                        As users assign and complete tasks, the AI will learn patterns and
                        start suggesting assignees automatically.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sources" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Phone Call Tasks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Phone className="h-4 w-4 text-blue-600" />
                      Phone Call Tasks
                    </CardTitle>
                    <CardDescription>
                      Tasks generated from phone call analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total tasks</span>
                        <span className="text-2xl font-bold">
                          {stats?.tasksBySource?.phone_call || 0}
                        </span>
                      </div>
                      <Separator />
                      <div className="text-sm text-muted-foreground">
                        Phone calls are analyzed for suggested actions, client information,
                        and urgency levels to create relevant tasks automatically.
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Email Tasks */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mail className="h-4 w-4 text-green-600" />
                      Email Tasks
                    </CardTitle>
                    <CardDescription>
                      Tasks generated from email intelligence
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Total tasks</span>
                        <span className="text-2xl font-bold">
                          {stats?.tasksBySource?.email || 0}
                        </span>
                      </div>
                      <Separator />
                      <div className="text-sm text-muted-foreground">
                        Emails are analyzed to extract action items, deadlines,
                        and client requests that become trackable tasks.
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Learning Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Learning Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <Sparkles className="h-8 w-8 text-purple-600" />
                      <div>
                        <h4 className="font-medium text-purple-900">AI is learning from your team</h4>
                        <p className="text-sm text-purple-700">
                          Every task completion, assignment, and feedback helps improve suggestions.
                          {patterns?.totalPatterns && patterns.totalPatterns > 10
                            ? " The system has enough data to make confident suggestions."
                            : " More data is needed for confident suggestions."}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-lg font-bold text-purple-600">
                          {patterns?.totalPatterns || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Patterns Learned</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-600">
                          {stats?.completionRate || 0}%
                        </div>
                        <div className="text-xs text-muted-foreground">Suggestion Accuracy</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-purple-600">
                          {Object.keys(patterns?.summary || {}).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Routing Rules</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
