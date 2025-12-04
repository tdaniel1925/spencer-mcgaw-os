"use client";

import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatCard, WeeklyChart, DonutChart } from "@/components/dashboard";
import {
  TrendingUp,
  Users,
  ClipboardList,
  Phone,
  DollarSign,
  FileText,
  Clock,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

interface AnalyticsData {
  metrics: {
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    totalClients: number;
    activeClients: number;
    callsHandled: number;
    documentsProcessed: number;
  };
  taskDistribution: { name: string; value: number; color: string }[];
  clientDistribution: { name: string; value: number; color: string }[];
  weeklyData: { day: string; thisWeek: number; lastWeek: number }[];
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");
  const [data, setData] = useState<AnalyticsData | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics?days=${period}`);
      if (response.ok) {
        const result = await response.json();
        setData(result);
      } else {
        toast.error("Failed to load analytics");
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast.error("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const defaultWeeklyData = [
    { day: "Sun", thisWeek: 0, lastWeek: 0 },
    { day: "Mon", thisWeek: 0, lastWeek: 0 },
    { day: "Tue", thisWeek: 0, lastWeek: 0 },
    { day: "Wed", thisWeek: 0, lastWeek: 0 },
    { day: "Thu", thisWeek: 0, lastWeek: 0 },
    { day: "Fri", thisWeek: 0, lastWeek: 0 },
    { day: "Sat", thisWeek: 0, lastWeek: 0 },
  ];

  return (
    <>
      <Header title="Analytics" />
      <main className="p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchAnalytics}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard
                title="Tasks Completed"
                value={data?.metrics.completedTasks.toString() || "0"}
                icon={<ClipboardList className="h-6 w-6 text-green-700" />}
                iconBg="bg-green-100"
              />
              <StatCard
                title="Active Clients"
                value={data?.metrics.activeClients.toString() || "0"}
                icon={<Users className="h-6 w-6 text-accent-foreground" />}
                iconBg="bg-accent"
              />
              <StatCard
                title="Calls Handled"
                value={data?.metrics.callsHandled.toString() || "0"}
                icon={<Phone className="h-6 w-6 text-blue-700" />}
                iconBg="bg-blue-100"
              />
              <StatCard
                title="Documents Processed"
                value={data?.metrics.documentsProcessed.toString() || "0"}
                icon={<FileText className="h-6 w-6 text-orange-700" />}
                iconBg="bg-orange-100"
              />
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <WeeklyChart
                title="Task Completion Trend"
                data={data?.weeklyData || defaultWeeklyData}
              />
              <DonutChart
                title="Task Distribution"
                subtitle="By Status"
                data={data?.taskDistribution || []}
                centerValue={data?.metrics.totalTasks.toString() || "0"}
                centerLabel="Tasks"
              />
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <DonutChart
                title="Client Status"
                subtitle="Overview"
                data={data?.clientDistribution || []}
                centerValue={data?.metrics.totalClients.toString() || "0"}
                centerLabel="Clients"
              />

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Performance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <p className="font-medium">Task Completion Rate</p>
                          <p className="text-sm text-muted-foreground">
                            Last {period} days
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold">
                        {data?.metrics.completionRate || 0}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <Phone className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium">Calls Handled</p>
                          <p className="text-sm text-muted-foreground">
                            Last {period} days
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold">
                        {data?.metrics.callsHandled || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                          <FileText className="h-5 w-5 text-accent-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">Documents Processed</p>
                          <p className="text-sm text-muted-foreground">
                            Last {period} days
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold">
                        {data?.metrics.documentsProcessed || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                          <Users className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="font-medium">Active Clients</p>
                          <p className="text-sm text-muted-foreground">
                            Out of {data?.metrics.totalClients || 0} total
                          </p>
                        </div>
                      </div>
                      <span className="text-2xl font-bold">
                        {data?.metrics.activeClients || 0}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </>
  );
}
