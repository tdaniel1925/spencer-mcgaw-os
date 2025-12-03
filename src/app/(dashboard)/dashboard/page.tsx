"use client";

import { Header } from "@/components/layout/header";
import {
  StatCard,
  ProgressStatCard,
  ActivityFeed,
  RecentTasks,
  WelcomeBanner,
  WeeklyChart,
  DonutChart,
} from "@/components/dashboard";
import {
  ClipboardList,
  CheckCircle,
  DollarSign,
  Phone,
  FileText,
  Users,
} from "lucide-react";

// Mock data - will be replaced with real data from Supabase
const mockActivities = [
  {
    id: "1",
    type: "call_received" as const,
    description: "Inbound call from John Smith regarding tax return status",
    user: { name: "Elizabeth", avatar: "" },
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: "2",
    type: "document_received" as const,
    description: "Bank statements received from ABC Corp via email",
    user: { name: "Britney", avatar: "" },
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
  },
  {
    id: "3",
    type: "task_completed" as const,
    description: "Completed: Send W-2 copy to Sarah Johnson",
    user: { name: "Elizabeth", avatar: "" },
    timestamp: new Date(Date.now() - 1000 * 60 * 90),
  },
  {
    id: "4",
    type: "email_received" as const,
    description: "New client inquiry from Mike Williams",
    user: { name: "Hunter McGaw", avatar: "" },
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: "5",
    type: "client_created" as const,
    description: "New client added: Williams Consulting LLC",
    user: { name: "Hunter McGaw", avatar: "" },
    timestamp: new Date(Date.now() - 1000 * 60 * 180),
  },
];

const mockTasks = [
  {
    id: "1",
    title: "Send 2023 tax return copy to client",
    client: { name: "John Smith", avatar: "" },
    assignee: { name: "Elizabeth", avatar: "" },
    status: "pending" as const,
    priority: "high" as const,
    source: "phone_call" as const,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    createdAt: new Date(),
  },
  {
    id: "2",
    title: "Review monthly bookkeeping package",
    client: { name: "ABC Corp", avatar: "" },
    assignee: { name: "Britney", avatar: "" },
    status: "in_progress" as const,
    priority: "medium" as const,
    source: "email" as const,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 48),
    createdAt: new Date(),
  },
  {
    id: "3",
    title: "Process payroll documents",
    client: { name: "XYZ Inc", avatar: "" },
    assignee: { name: "Britney", avatar: "" },
    status: "pending" as const,
    priority: "urgent" as const,
    source: "document_intake" as const,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 8),
    createdAt: new Date(),
  },
  {
    id: "4",
    title: "Schedule appointment with new client",
    client: { name: "Williams Consulting", avatar: "" },
    assignee: { name: "Hunter McGaw", avatar: "" },
    status: "pending" as const,
    priority: "medium" as const,
    source: "manual" as const,
    createdAt: new Date(),
  },
  {
    id: "5",
    title: "Respond to IRS notice",
    client: { name: "Tech Solutions LLC", avatar: "" },
    assignee: { name: "Hunter McGaw", avatar: "" },
    status: "in_progress" as const,
    priority: "urgent" as const,
    source: "email" as const,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    createdAt: new Date(),
  },
];

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
  { name: "Completed", value: 45, color: "#143009" },
  { name: "In Progress", value: 30, color: "#DBC16F" },
  { name: "Pending", value: 20, color: "#4a7c3a" },
  { name: "Overdue", value: 5, color: "#dc2626" },
];

export default function DashboardPage() {
  return (
    <>
      <Header title="Dashboard" />
      <main className="p-6 space-y-6">
        {/* Welcome Banner & Quick Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <WelcomeBanner userName="Hunter" className="lg:col-span-2" />
          <DonutChart
            title="Task Distribution"
            subtitle="Overview"
            data={taskDistribution}
            centerValue="156"
            centerLabel="Total Tasks"
            showLegend={false}
          />
        </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Tasks"
            value="156"
            change={{ value: 12.5, period: "30 days" }}
            icon={<ClipboardList className="h-6 w-6 text-primary-foreground" />}
            iconBg="bg-primary"
          />
          <StatCard
            title="Completed Tasks"
            value="124"
            change={{ value: 8.2, period: "30 days" }}
            icon={<CheckCircle className="h-6 w-6 text-green-700" />}
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
            title="Calls Today"
            value="12"
            change={{ value: -5.4, period: "vs yesterday" }}
            icon={<Phone className="h-6 w-6 text-blue-700" />}
            iconBg="bg-blue-100"
          />
        </div>

        {/* Progress Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProgressStatCard
            title="Tasks Completed"
            value="124"
            progress={80}
            change={{ value: 8.2, period: "30 days" }}
            progressColor="#143009"
          />
          <ProgressStatCard
            title="Documents Processed"
            value="267"
            progress={92}
            change={{ value: 15.3, period: "30 days" }}
            progressColor="#DBC16F"
          />
          <ProgressStatCard
            title="Calls Handled"
            value="89"
            progress={75}
            change={{ value: -2.1, period: "30 days" }}
            progressColor="#4a7c3a"
          />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WeeklyChart title="Weekly Tasks" data={weeklyTaskData} />
          <DonutChart
            title="Task Status"
            subtitle="Statistics"
            data={taskDistribution}
            centerValue="156"
            centerLabel="Total"
          />
        </div>

        {/* Tasks & Activity Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <RecentTasks tasks={mockTasks} className="lg:col-span-2" />
          <ActivityFeed activities={mockActivities} />
        </div>
      </main>
    </>
  );
}
