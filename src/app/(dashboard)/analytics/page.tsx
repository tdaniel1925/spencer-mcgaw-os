"use client";

import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard, WeeklyChart, DonutChart } from "@/components/dashboard";
import {
  TrendingUp,
  TrendingDown,
  Users,
  ClipboardList,
  Phone,
  DollarSign,
  FileText,
  Clock,
} from "lucide-react";

const weeklyTaskData = [
  { day: "Sun", thisWeek: 12, lastWeek: 8 },
  { day: "Mon", thisWeek: 25, lastWeek: 20 },
  { day: "Tue", thisWeek: 18, lastWeek: 22 },
  { day: "Wed", thisWeek: 30, lastWeek: 25 },
  { day: "Thu", thisWeek: 28, lastWeek: 18 },
  { day: "Fri", thisWeek: 35, lastWeek: 30 },
  { day: "Sat", thisWeek: 15, lastWeek: 12 },
];

const taskDistribution = [
  { name: "Tax Prep", value: 45, color: "#143009" },
  { name: "Bookkeeping", value: 25, color: "#DBC16F" },
  { name: "Payroll", value: 15, color: "#4a7c3a" },
  { name: "Consulting", value: 10, color: "#8b5e3c" },
  { name: "Other", value: 5, color: "#6b7280" },
];

const clientGrowth = [
  { name: "Active", value: 85, color: "#143009" },
  { name: "Inactive", value: 10, color: "#DBC16F" },
  { name: "Prospects", value: 5, color: "#4a7c3a" },
];

export default function AnalyticsPage() {
  return (
    <>
      <Header title="Analytics" />
      <main className="p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex justify-end">
          <Select defaultValue="30">
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

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Revenue"
            value="$124,500"
            change={{ value: 12.5, period: "30 days" }}
            icon={<DollarSign className="h-6 w-6 text-primary-foreground" />}
            iconBg="bg-primary"
          />
          <StatCard
            title="Tasks Completed"
            value="156"
            change={{ value: 8.2, period: "30 days" }}
            icon={<ClipboardList className="h-6 w-6 text-green-700" />}
            iconBg="bg-green-100"
          />
          <StatCard
            title="Active Clients"
            value="89"
            change={{ value: 3.1, period: "30 days" }}
            icon={<Users className="h-6 w-6 text-accent-foreground" />}
            iconBg="bg-accent"
          />
          <StatCard
            title="Avg Response Time"
            value="2.4h"
            change={{ value: -15.2, period: "30 days" }}
            icon={<Clock className="h-6 w-6 text-blue-700" />}
            iconBg="bg-blue-100"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WeeklyChart title="Task Completion Trend" data={weeklyTaskData} />
          <DonutChart
            title="Service Distribution"
            subtitle="By Type"
            data={taskDistribution}
            centerValue="100%"
            centerLabel="Services"
          />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <DonutChart
            title="Client Status"
            subtitle="Overview"
            data={clientGrowth}
            centerValue="89"
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
                      <p className="text-sm text-muted-foreground">Up from last month</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-green-600">94%</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-medium">Calls Handled</p>
                      <p className="text-sm text-muted-foreground">This month</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">247</span>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                      <FileText className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Documents Processed</p>
                      <p className="text-sm text-muted-foreground">This month</p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold">432</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
