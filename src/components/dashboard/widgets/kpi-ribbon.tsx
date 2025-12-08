"use client";

import { useRouter } from "next/navigation";
import { KPICard } from "./kpi-card";
import {
  ListTodo,
  AlertTriangle,
  Clock,
  CheckCircle,
  Sparkles,
} from "lucide-react";

interface KPIRibbonProps {
  stats: {
    totalTasks: number;
    pendingTasks: number;
    overdueTasks: number;
    dueToday: number;
    completedToday: number;
    timeSavedHours: number;
  };
  loading?: boolean;
}

export function KPIRibbon({ stats, loading = false }: KPIRibbonProps) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <KPICard
        title="My Tasks"
        value={stats.totalTasks}
        subtitle={`${stats.pendingTasks} pending`}
        icon={ListTodo}
        color="primary"
        onClick={() => router.push("/taskpool")}
        loading={loading}
      />
      <KPICard
        title="Urgent"
        value={stats.overdueTasks}
        subtitle="overdue tasks"
        icon={AlertTriangle}
        color={stats.overdueTasks > 0 ? "danger" : "success"}
        onClick={() => router.push("/taskpool")}
        loading={loading}
      />
      <KPICard
        title="Due Today"
        value={stats.dueToday}
        subtitle="tasks due"
        icon={Clock}
        color={stats.dueToday > 3 ? "warning" : "info"}
        onClick={() => router.push("/taskpool")}
        loading={loading}
      />
      <KPICard
        title="Completed"
        value={stats.completedToday}
        subtitle="today"
        icon={CheckCircle}
        color="success"
        onClick={() => router.push("/kanban")}
        loading={loading}
      />
      <KPICard
        title="Time Saved"
        value={`${stats.timeSavedHours}h`}
        subtitle="via automation"
        icon={Sparkles}
        color="primary"
        loading={loading}
      />
    </div>
  );
}
