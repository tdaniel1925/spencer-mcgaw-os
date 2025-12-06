"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  MessageSquare,
  Send,
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown,
  Users,
  RefreshCw,
  ArrowLeft,
  Calendar,
  BarChart3,
  Zap,
} from "lucide-react";
import { format, subDays, parseISO, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";

interface AnalyticsData {
  totalMessages: number;
  totalInbound: number;
  totalOutbound: number;
  totalDelivered: number;
  totalFailed: number;
  responseRate: number;
  avgResponseTime: number;
  activeConversations: number;
  optOutCount: number;
  dailyStats: {
    date: string;
    inbound: number;
    outbound: number;
    delivered: number;
    failed: number;
  }[];
  topContacts: {
    contact_id: string;
    contact_name: string;
    message_count: number;
  }[];
}

export default function SMSAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState("30");

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sms/analytics?days=${dateRange}`);
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const formatResponseTime = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  // Calculate max for chart scaling
  const maxDailyMessages = analytics?.dailyStats
    ? Math.max(...analytics.dailyStats.map(d => d.inbound + d.outbound), 1)
    : 1;

  return (
    <>
      <Header title="SMS Analytics" />

      <main className="flex-1 overflow-auto">
        {/* Header Bar */}
        <div className="border-b bg-card/50 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href="/sms">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back to SMS
                </Button>
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={loadAnalytics}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Refresh
              </Button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-100">
                    <MessageSquare className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Messages</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">{analytics?.totalMessages || 0}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-100">
                    <ArrowUpRight className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sent</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">{analytics?.totalOutbound || 0}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-100">
                    <ArrowDownLeft className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Received</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">{analytics?.totalInbound || 0}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-100">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Delivered</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">{analytics?.totalDelivered || 0}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-red-100">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Failed</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">{analytics?.totalFailed || 0}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Response Rate</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">
                        {((analytics?.responseRate || 0) * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                  <div className="p-2 rounded-lg bg-amber-100">
                    <TrendingUp className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Response Time</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">
                        {formatResponseTime(analytics?.avgResponseTime || 0)}
                      </p>
                    )}
                  </div>
                  <div className="p-2 rounded-lg bg-blue-100">
                    <Zap className="h-5 w-5 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Conversations</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">{analytics?.activeConversations || 0}</p>
                    )}
                  </div>
                  <div className="p-2 rounded-lg bg-green-100">
                    <Users className="h-5 w-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Opt-outs</p>
                    {loading ? (
                      <Skeleton className="h-8 w-20" />
                    ) : (
                      <p className="text-2xl font-bold">{analytics?.optOutCount || 0}</p>
                    )}
                  </div>
                  <div className="p-2 rounded-lg bg-red-100">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Message Volume Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Message Volume
                </CardTitle>
                <CardDescription>Daily message counts over the selected period</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="h-64 flex items-center justify-center">
                    <Skeleton className="h-full w-full" />
                  </div>
                ) : !analytics?.dailyStats?.length ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                ) : (
                  <div className="h-64">
                    <div className="flex items-end gap-1 h-48">
                      {analytics.dailyStats.map((day, idx) => {
                        const total = day.inbound + day.outbound;
                        const height = (total / maxDailyMessages) * 100;
                        const inboundHeight = total > 0 ? (day.inbound / total) * height : 0;
                        const outboundHeight = total > 0 ? (day.outbound / total) * height : 0;

                        return (
                          <div
                            key={idx}
                            className="flex-1 flex flex-col justify-end items-center gap-0.5 group"
                            title={`${format(parseISO(day.date), "MMM d")}: ${day.outbound} sent, ${day.inbound} received`}
                          >
                            <div
                              className="w-full bg-green-500 rounded-t transition-all group-hover:opacity-80"
                              style={{ height: `${outboundHeight}%` }}
                            />
                            <div
                              className="w-full bg-purple-500 rounded-b transition-all group-hover:opacity-80"
                              style={{ height: `${inboundHeight}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                      <span>{format(subDays(new Date(), parseInt(dateRange)), "MMM d")}</span>
                      <span>Today</span>
                    </div>
                    <div className="flex items-center justify-center gap-6 mt-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-green-500" />
                        <span className="text-sm">Sent</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-purple-500" />
                        <span className="text-sm">Received</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Contacts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Top Contacts
                </CardTitle>
                <CardDescription>Most messaged contacts</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex items-center gap-3">
                        <Skeleton className="h-8 w-8 rounded-full" />
                        <div className="flex-1">
                          <Skeleton className="h-4 w-32" />
                        </div>
                        <Skeleton className="h-4 w-8" />
                      </div>
                    ))}
                  </div>
                ) : !analytics?.topContacts?.length ? (
                  <div className="py-8 text-center text-muted-foreground">
                    No contacts yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {analytics.topContacts.slice(0, 5).map((contact, idx) => (
                      <div key={contact.contact_id} className="flex items-center gap-3">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
                          idx === 0 ? "bg-amber-100 text-amber-700" :
                          idx === 1 ? "bg-slate-100 text-slate-700" :
                          idx === 2 ? "bg-orange-100 text-orange-700" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{contact.contact_name}</p>
                        </div>
                        <div className="text-sm font-medium">
                          {contact.message_count}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Delivery Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Performance</CardTitle>
              <CardDescription>Message delivery success rates</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-24" />
              ) : (
                <div className="grid grid-cols-3 gap-8">
                  <div className="text-center">
                    <div className="text-4xl font-bold text-green-600">
                      {analytics?.totalOutbound && analytics.totalOutbound > 0
                        ? ((analytics.totalDelivered / analytics.totalOutbound) * 100).toFixed(1)
                        : 0}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Delivery Rate</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-amber-600">
                      {analytics?.totalOutbound && analytics.totalOutbound > 0
                        ? (((analytics.totalOutbound - analytics.totalDelivered - analytics.totalFailed) / analytics.totalOutbound) * 100).toFixed(1)
                        : 0}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Pending</p>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-red-600">
                      {analytics?.totalOutbound && analytics.totalOutbound > 0
                        ? ((analytics.totalFailed / analytics.totalOutbound) * 100).toFixed(1)
                        : 0}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Failure Rate</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
